import { Controller } from '../lib/controller'
import { StatsService } from '../services/stats.service'

export default class StatsController extends Controller {
  // GET /api/stats/overview
  async overview() {
    return this.data(await StatsService.overview(this.prisma))
  }
}
