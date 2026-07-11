import type { ApiResponse, AppRequest } from '../lib/controller'
import { Controller } from '../lib/controller'

export default class TestController extends Controller {
  // GET /api/test/:foo
  async show(req: AppRequest<{ Params: { foo: string } }>): Promise<ApiResponse<{ foo: string, length: number }>> {
    const foo = req.params.foo

    if (foo === 'fail')
      return this.error('That is not allowed', 'foo must not be "fail"')

    return this.data({ foo, length: foo.length })
  }
}
