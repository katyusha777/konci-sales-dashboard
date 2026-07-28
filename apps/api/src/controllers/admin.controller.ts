import { Controller } from '../lib/controller'
import { LeadListService } from '../services/lead-list.service'
import { LeadService } from '../services/lead.service'

// Admin danger zone: whole-table wipes for nuking demo data before go-live.
export default class AdminController extends Controller {
  // GET /api/admin/counts — shown on the admin page and in confirmations
  async counts() {
    const [leads, lists, contacts, videos, emails] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.leadList.count(),
      this.prisma.contact.count(),
      this.prisma.video.count(),
      this.prisma.email.count(),
    ])
    return this.data({ leads, lists, contacts, videos, emails })
  }

  // POST /api/admin/delete-all-leads — cascades everything lead-owned + R2 video files
  async deleteAllLeads() {
    return this.data({ deleted: await LeadService.removeAll(this.prisma, this.c.env) })
  }

  // POST /api/admin/delete-all-lists — memberships cascade; leads stay
  async deleteAllLists() {
    return this.data({ deleted: await LeadListService.removeAll(this.prisma) })
  }
}
