import prisma from '../config/prisma.js';
import {
  NATIONAL_ID_CATEGORY,
  NATIONAL_ID_CORE_SERVICES,
  NATIONAL_ID_SERVICE_NAMES,
} from '../utils/nqsScope.js';

export class ServiceService {
  static async ensureCoreNationalIdServices() {
    await Promise.all(
      NATIONAL_ID_CORE_SERVICES.map(async (service) => {
        const existing = await prisma.service.findFirst({
          where: { name: service.name, category: service.category }
        });
        if (!existing) {
          await prisma.service.create({ data: service });
        }
      })
    );
  }

  static async listServices() {
    await this.ensureCoreNationalIdServices();
    const services = await prisma.service.findMany({
      where: {
        category: NATIONAL_ID_CATEGORY
      },
      orderBy: { name: 'asc' }
    });
    return services;
  }

  static async getServiceById(id) {
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw { statusCode: 404, message: 'Service not found' };
    }
    if (service.category !== NATIONAL_ID_CATEGORY) {
      throw { statusCode: 404, message: 'Service is outside the NQS scope' };
    }
    return service;
  }

  static async createService({ data, user, ipAddress }) {
    const { name, description, category = NATIONAL_ID_CATEGORY, duration, requirements, priority, status } = data;
    const cleanName = String(name || '').trim();
    const cleanDescription = String(description || '').trim();

    if (!cleanName) {
      throw { statusCode: 400, message: 'Service name is required' };
    }
    if (!cleanDescription) {
      throw { statusCode: 400, message: 'Service description is required' };
    }
    if (category !== NATIONAL_ID_CATEGORY) {
      throw { statusCode: 400, message: 'Service category must be National ID' };
    }

    const serviceExists = await prisma.service.findFirst({ where: { name: cleanName } });
    if (serviceExists) {
      throw { statusCode: 400, message: 'Service name already exists' };
    }

    const service = await prisma.service.create({
      data: {
        name: cleanName,
        description: cleanDescription,
        category,
        duration: Number(duration) || 15,
        requirements,
        priority: priority || 'Medium',
        status: status || 'Active'
      }
    });

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: 'Create Service',
        details: `Created new service: ${cleanName}`,
        ipAddress: ipAddress || '127.0.0.1'
      }
    });

    return service;
  }

  static async updateService({ id, data, user, ipAddress }) {
    const service = await prisma.service.findUnique({ where: { id } });

    if (!service) {
      throw { statusCode: 404, message: 'Service not found' };
    }

    const nextName = String(data.name ?? service.name).trim();
    const nextCategory = data.category ?? service.category;
    if (!nextName) {
      throw { statusCode: 400, message: 'Service name is required' };
    }
    if (nextCategory !== NATIONAL_ID_CATEGORY) {
      throw { statusCode: 400, message: 'Service category must be National ID' };
    }

    const updatedService = await prisma.service.update({
      where: { id },
      data: {
        ...data,
        name: nextName,
        category: nextCategory,
        duration: Number(data.duration ?? service.duration) || service.duration
      }
    });

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: 'Update Service',
        details: `Updated service ID: ${service.id} (${service.name})`,
        ipAddress: ipAddress || '127.0.0.1'
      }
    });

    return updatedService;
  }

  static async deleteService({ id, user, ipAddress }) {
    const service = await prisma.service.findUnique({ where: { id } });

    if (!service) {
      throw { statusCode: 404, message: 'Service not found' };
    }

    if (NATIONAL_ID_SERVICE_NAMES.includes(service.name) && service.category === NATIONAL_ID_CATEGORY) {
      throw {
        statusCode: 400,
        message: 'Core National ID services are required and cannot be deleted'
      };
    }

    const linkedTickets = await prisma.ticket.count({ where: { service: service.id } });
    if (linkedTickets > 0) {
      throw {
        statusCode: 400,
        message: 'Cannot delete a service that has queue tickets'
      };
    }

    await prisma.service.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: 'Delete Service',
        details: `Deleted service name: ${service.name}`,
        ipAddress: ipAddress || '127.0.0.1'
      }
    });

    return true;
  }
}
