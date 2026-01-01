import prisma from '../../config/database'
import cacheService from '../../utils/cache'
import logger from '../../config/logger'
import { NotFoundError, ValidationError } from '../../utils/errors'

interface CategoryNode {
  id: string
  name: string
  parentId: string | null
  children?: CategoryNode[]
}

export class CategoryService {
  private readonly CATEGORY_TREE_CACHE_KEY = 'category:tree'
  private readonly CATEGORY_TREE_TTL = 3600 // 1 hour

  /**
   * Get all categories as flat list
   */
  async getAllCategories() {
    return await prisma.category.findMany({
      include: {
        _count: { select: { products: true } },
        parent: true,
        children: true,
      },
      orderBy: { name: 'asc' },
    })
  }

  /**
   * Get category tree with hierarchical structure
   */
  async getCategoryTree(): Promise<CategoryNode[]> {
    // Check cache first
    const cached = await cacheService.get(this.CATEGORY_TREE_CACHE_KEY)
    if (cached) {
      logger.debug('Category tree retrieved from cache')
      return cached
    }

    // Fetch all categories from database
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        parentId: true,
      },
      orderBy: { name: 'asc' },
    })

    // Build tree structure
    const tree = this.buildTree(categories)

    // Cache the tree
    await cacheService.set(
      this.CATEGORY_TREE_CACHE_KEY,
      tree,
      this.CATEGORY_TREE_TTL
    )
    logger.info('Category tree built and cached')

    return tree
  }

  /**
   * Build hierarchical tree from flat category list
   */
  private buildTree(categories: CategoryNode[]): CategoryNode[] {
    const categoryMap = new Map<string, CategoryNode>()
    const roots: CategoryNode[] = []

    // Create map of all categories with children array
    categories.forEach((category) => {
      categoryMap.set(category.id, { ...category, children: [] })
    })

    // Build parent-child relationships
    categories.forEach((category) => {
      const node = categoryMap.get(category.id)!

      if (category.parentId === null) {
        // Root category
        roots.push(node)
      } else {
        // Child category - add to parent's children
        const parent = categoryMap.get(category.parentId)
        if (parent) {
          parent.children!.push(node)
        }
      }
    })

    return roots
  }

  /**
   * Get all descendant category IDs using DFS
   * @param categoryId - Starting category ID
   * @returns Array of all descendant category IDs (including the starting category)
   */
  async getDescendantCategoryIds(categoryId: string): Promise<string[]> {
    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    })

    if (!category) {
      throw new NotFoundError('Category not found')
    }

    // Get full category tree
    const tree = await this.getCategoryTree()

    // Find the target category node in tree
    const targetNode = this.findCategoryInTree(tree, categoryId)

    if (!targetNode) {
      // Category exists but not in tree (shouldn't happen)
      return [categoryId]
    }

    // Perform DFS to collect all descendant IDs
    const descendantIds: string[] = []
    this.dfsTraversal(targetNode, descendantIds)

    logger.debug(
      `Found ${descendantIds.length} categories in subtree of ${categoryId}`
    )
    return descendantIds
  }

  /**
   * Find a category node in the tree using DFS
   */
  private findCategoryInTree(
    nodes: CategoryNode[],
    targetId: string
  ): CategoryNode | null {
    for (const node of nodes) {
      if (node.id === targetId) {
        return node
      }

      if (node.children && node.children.length > 0) {
        const found = this.findCategoryInTree(node.children, targetId)
        if (found) {
          return found
        }
      }
    }

    return null
  }

  /**
   * DFS traversal to collect all category IDs in subtree
   * @param node - Current node
   * @param result - Array to collect IDs
   */
  private dfsTraversal(node: CategoryNode, result: string[]): void {
    // Add current node ID
    result.push(node.id)

    // Recursively traverse children
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this.dfsTraversal(child, result)
      }
    }
  }

  /**
   * Get products by category including all descendant categories
   */
  async getProductsByCategoryTree(categoryId: string) {
    // Get all descendant category IDs
    const categoryIds = await this.getDescendantCategoryIds(categoryId)

    // Fetch products from all these categories
    const products = await prisma.product.findMany({
      where: {
        categoryId: {
          in: categoryIds,
        },
      },
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    logger.info(
      `Found ${products.length} products in category tree ${categoryId}`
    )
    return products
  }

  async getCategoryById(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { products: true },
    })

    if (!category) {
      throw new NotFoundError('Category not found')
    }

    return category
  }

  async createCategory(data: { name: string; parentId?: string }) {
    if (!data.name.trim()) {
      throw new ValidationError('Category name is required')
    }

    // Validate parent category exists if parentId provided
    if (data.parentId) {
      const parentExists = await prisma.category.findUnique({
        where: { id: data.parentId },
      })

      if (!parentExists) {
        throw new NotFoundError('Parent category not found')
      }
    }

    const category = await prisma.category.create({
      data: {
        name: data.name,
        parentId: data.parentId || null,
      },
      include: {
        parent: true,
        children: true,
      },
    })

    // Invalidate category tree cache
    await cacheService.delete(this.CATEGORY_TREE_CACHE_KEY)
    logger.info(`Category created: ${category.id} - ${category.name}`)

    return category
  }

  async updateCategory(id: string, data: { name?: string; parentId?: string }) {
    await this.getCategoryById(id)

    // Validate parent category if being updated
    if (data.parentId !== undefined) {
      if (data.parentId === id) {
        throw new ValidationError('Category cannot be its own parent')
      }

      if (data.parentId) {
        const parentExists = await prisma.category.findUnique({
          where: { id: data.parentId },
        })

        if (!parentExists) {
          throw new NotFoundError('Parent category not found')
        }

        // Check for circular reference
        const descendants = await this.getDescendantCategoryIds(id)
        if (descendants.includes(data.parentId)) {
          throw new ValidationError(
            'Cannot create circular category relationship'
          )
        }
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        parentId: data.parentId === null ? null : data.parentId,
      },
      include: {
        parent: true,
        children: true,
      },
    })

    // Invalidate category tree cache
    await cacheService.delete(this.CATEGORY_TREE_CACHE_KEY)
    logger.info(`Category updated: ${id}`)

    return category
  }

  async deleteCategory(id: string) {
    await this.getCategoryById(id)

    // Check if category has children
    const children = await prisma.category.findMany({
      where: { parentId: id },
    })

    if (children.length > 0) {
      throw new ValidationError(
        'Cannot delete category with subcategories. Delete or reassign subcategories first.'
      )
    }

    // Check if category has products
    const productsCount = await prisma.product.count({
      where: { categoryId: id },
    })

    if (productsCount > 0) {
      throw new ValidationError(
        `Cannot delete category with ${productsCount} product(s). Reassign or delete products first.`
      )
    }

    await prisma.category.delete({
      where: { id },
    })

    // Invalidate category tree cache
    await cacheService.delete(this.CATEGORY_TREE_CACHE_KEY)
    logger.info(`Category deleted: ${id}`)
  }
}
