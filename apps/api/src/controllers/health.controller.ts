import { Controller } from '../lib/controller'

export default class HealthController extends Controller {
  async check() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }

  async db() {
    const count = await this.prisma.healthCheck.count()
    return { status: 'ok', database: 'connected', healthChecks: count }
  }

  async dbInsert() {
    const row = await this.prisma.healthCheck.create({ data: {} })
    return this.data(row)
  }
}
