import type { AppContext } from './context'

export interface RouteSchema {
  Params?: Record<string, string>
  Query?: Record<string, string | undefined>
}

// Mirrors FastifyRequest<{ Params: {...} }> — declare the shape in the method
// signature, then access req.params.foo directly. URL params and query values
// are always strings at runtime, so the schema is constrained to string types.
export interface AppRequest<T extends RouteSchema = RouteSchema> {
  params: T['Params'] extends object ? T['Params'] : Record<string, string>
  query: T['Query'] extends object ? T['Query'] : Record<string, string | undefined>
  raw: Request
}

// Standard API envelope. Annotate controller methods with it to lock the shape:
//   async show(req: ...): Promise<ApiResponse<{ foo: string }>>
export interface ApiData<T> { success: true, data: T }
export interface ApiMessage { success: true, message: string | null }
export interface ApiError { success: false, message: string | null, info: string | null }
export type ApiResponse<T = unknown> = ApiData<T> | ApiMessage | ApiError

export abstract class Controller {
  constructor(protected c: AppContext) {}

  protected get prisma() {
    return this.c.var.prisma
  }

  // Set by authMiddleware — available in all controllers behind protected routes.
  protected get user() {
    return this.c.var.user
  }

  protected empty(): [] {
    return []
  }

  protected data<T>(data: T): ApiData<T> {
    return { success: true, data }
  }

  protected success(message: string | null = null): ApiMessage {
    return { success: true, message }
  }

  protected error(message: string | null = null, info: string | null = null): ApiError {
    return { success: false, message, info }
  }
}

type ControllerCtor<C extends Controller> = new (c: AppContext) => C

// Laravel-style route → controller-method binding:
//   healthRoutes.get('/', action(HealthController, 'check'))
// Instantiates the controller per request, builds the req object, and
// JSON-serializes plain-object return values (a returned Response passes through).
export function action<C extends Controller>(Ctor: ControllerCtor<C>, method: keyof C & string) {
  return async (c: AppContext) => {
    const controller = new Ctor(c)
    const handler = controller[method]
    if (typeof handler !== 'function')
      throw new TypeError(`${Ctor.name}.${String(method)} is not a method`)

    const req: AppRequest = {
      params: c.req.param(),
      query: c.req.query(),
      raw: c.req.raw,
    }
    const result = await (handler as (req: AppRequest) => unknown).call(controller, req)
    return result instanceof Response ? result : c.json(result as Record<string, unknown>)
  }
}
