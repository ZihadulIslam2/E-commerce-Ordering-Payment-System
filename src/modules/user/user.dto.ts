export interface CreateUserDTO {
  email: string
  name: string
  phone?: string
}

export interface UpdateUserDTO {
  name?: string
  phone?: string
}

export interface UserResponse {
  id: string
  email: string
  name: string
  phone?: string
  createdAt: Date
  updatedAt: Date
}
