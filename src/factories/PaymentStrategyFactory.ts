import { IPaymentStrategy } from '../types'
import { StripePaymentStrategy } from '../strategies/StripePaymentStrategy'
import { BkashPaymentStrategy } from '../strategies/BkashPaymentStrategy'
import { ValidationError } from '../utils/errors'
import logger from '../config/logger'

/**
 * Payment Strategy Factory
 * Uses Strategy + Factory patterns to provide payment provider implementations
 *
 * The Order service does NOT need to know about specific payment providers.
 * It only depends on the IPaymentStrategy interface through this factory.
 *
 * This ensures:
 * - Loose coupling between Order and Payment services
 * - Easy to add new payment providers
 * - Provider-specific details are encapsulated
 */
export class PaymentStrategyFactory {
  private static strategies: Map<string, IPaymentStrategy> = new Map()

  /**
   * Get payment strategy by provider name
   * Caches instantiated strategies for performance
   * @param provider - Payment provider name (stripe, bkash)
   * @returns IPaymentStrategy implementation
   * @throws ValidationError if provider is not supported
   */
  static getStrategy(provider: string): IPaymentStrategy {
    const normalizedProvider = provider.toLowerCase()

    // Return cached strategy if exists
    if (this.strategies.has(normalizedProvider)) {
      logger.debug(`Using cached strategy for provider: ${normalizedProvider}`)
      return this.strategies.get(normalizedProvider)!
    }

    // Create and cache new strategy
    let strategy: IPaymentStrategy

    switch (normalizedProvider) {
      case 'stripe':
        strategy = new StripePaymentStrategy()
        logger.info('Stripe payment strategy instantiated')
        break

      case 'bkash':
        strategy = new BkashPaymentStrategy()
        logger.info('bKash payment strategy instantiated')
        break

      default:
        throw new ValidationError(
          `Unsupported payment provider: ${provider}. Supported providers: stripe, bkash`
        )
    }

    // Cache for future use
    this.strategies.set(normalizedProvider, strategy)
    return strategy
  }

  /**
   * Clear cached strategies
   * Useful for testing or reinitialization
   */
  static clearCache(): void {
    this.strategies.clear()
    logger.info('Payment strategy cache cleared')
  }
}
