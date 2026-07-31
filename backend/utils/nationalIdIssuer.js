import prisma from '../config/prisma.js';
import { ensureCitizenPermanentNqsId, syncCitizenIdentityProfile } from './citizenIdentity.js';

const ticketCitizenId = (ticket = {}) => ticket.citizen?.id || ticket.citizen?._id || ticket.citizen;

export const issueNationalIdForCompletedRegistration = async (ticket) => {
  if (!ticket || ticket.requestType !== 'new_national_id') {
    return '';
  }

  const citizenId = ticketCitizenId(ticket);
  if (!citizenId) {
    return '';
  }

  const user = await prisma.user.findUnique({ where: { id: citizenId }, include: { citizenProfile: true } });
  if (!user) {
    return '';
  }

  const nationalIdNumber = await ensureCitizenPermanentNqsId(user);
  await syncCitizenIdentityProfile(citizenId, {
    nationalId: nationalIdNumber,
    nationalIdStatus: 'ISSUED'
  });

  ticket.registrationDetails = {
    ...(ticket.registrationDetails || {}),
    nationalIdNumber
  };

  return nationalIdNumber;
};
