import prisma from '../config/prisma.js';

const randomDigits = (length = 4) => String(Math.floor(Math.random() * (10 ** length))).padStart(length, '0');

export const isIssuedNationalIdStatus = (status = '') => {
  const normalized = String(status || '').trim().toUpperCase();
  return ['ACTIVE', 'COMPLETED', 'ISSUED'].includes(normalized);
};

export const generatePermanentNqsId = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const nationalId = `NQS-${randomDigits(4)}`;
    const [userExists, citizenExists] = await Promise.all([
      prisma.user.count({ where: { nationalId } }),
      prisma.citizen.count({ where: { nationalId } })
    ]);
    if (!userExists && !citizenExists) return nationalId;
  }
  throw new Error('Could not generate a unique permanent NQS ID.');
};

/** Find the one locked National ID for this citizen (never invent a second one). */
export const resolveExistingCitizenNationalId = async (userOrId) => {
  const userId = typeof userOrId === 'string' ? userOrId : userOrId?.id;
  if (!userId) return '';

  const user = typeof userOrId === 'string'
    ? await prisma.user.findUnique({ where: { id: userId }, include: { citizenProfile: true } })
    : userOrId;
  if (!user) return '';

  const fromProfile = String(user.citizenProfile?.nationalId || user.nationalId || '').trim();
  if (fromProfile) return fromProfile;

  // Oldest ticket with any stored National ID wins (covers cancel/rebook history).
  const tickets = await prisma.ticket.findMany({
    where: { citizen: userId },
    orderBy: { createdAt: 'asc' },
    select: {
      nationalIdNumber: true,
      registrationDetails: true,
      replacementDetails: true,
      updateDetails: true
    },
    take: 50
  });

  for (const ticket of tickets) {
    const fromTicket = String(
      ticket?.nationalIdNumber
      || ticket?.registrationDetails?.nationalIdNumber
      || ticket?.replacementDetails?.nationalIdNumber
      || ticket?.updateDetails?.nationalIdNumber
      || ''
    ).trim();
    if (fromTicket) return fromTicket;
  }

  return '';
};

/**
 * One citizen = one permanent National ID for life.
 * Reuses existing ID across updates, cancellations, replacements, and re-bookings.
 * Only generates a new ID when the citizen has never been assigned one.
 */
export const ensureCitizenPermanentNqsId = async (userOrId) => {
  const userId = typeof userOrId === 'string' ? userOrId : userOrId?.id;
  if (!userId) return '';

  const user = typeof userOrId === 'string'
    ? await prisma.user.findUnique({ where: { id: userId }, include: { citizenProfile: true } })
    : (userOrId?.citizenProfile ? userOrId : await prisma.user.findUnique({
      where: { id: userId },
      include: { citizenProfile: true }
    }));
  if (!user) return '';

  const existing = await resolveExistingCitizenNationalId(user);
  const nationalId = existing || await generatePermanentNqsId();

  if (user.nationalId !== nationalId) {
    await prisma.user.update({
      where: { id: userId },
      data: { nationalId }
    });
  }

  await prisma.citizen.upsert({
    where: { userId },
    update: { nationalId },
    create: {
      userId,
      fullName: user.name || user.username || '',
      firstName: user.firstName || '',
      middleName: user.middleName || '',
      lastName: user.lastName || '',
      email: user.email || null,
      phone: user.phone || '',
      nationalId,
      nationalIdStatus: user.nationalIdStatus || user.citizenProfile?.nationalIdStatus || 'NOT_STARTED',
      cardSerialNumber: user.cardSerialNumber || user.citizenProfile?.cardSerialNumber || '',
      cardStatus: user.cardStatus || user.citizenProfile?.cardStatus || 'NOT_ISSUED',
      dateOfBirth: user.dateOfBirth || '',
      address: user.address || '',
      district: user.district || '',
      maritalStatus: user.maritalStatus || ''
    }
  });

  // Keep all of this citizen's tickets aligned to the same permanent ID.
  await prisma.ticket.updateMany({
    where: {
      citizen: userId,
      NOT: { nationalIdNumber: nationalId }
    },
    data: { nationalIdNumber: nationalId }
  });

  return nationalId;
};

export const syncCitizenIdentityProfile = async (userId, data = {}) => {
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { citizenProfile: true } });
  if (!user) return null;

  // Locked ID wins — never replace with a different number from request payload.
  const lockedId = await resolveExistingCitizenNationalId(user);
  const requestedId = String(data.nationalId || '').trim();
  const nationalId = lockedId || requestedId || await generatePermanentNqsId();

  const userData = {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
    ...(data.middleName !== undefined ? { middleName: data.middleName } : {}),
    ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
    ...(data.email !== undefined ? { email: data.email } : {}),
    ...(data.phone !== undefined ? { phone: data.phone } : {}),
    nationalId,
    ...(data.nationalIdStatus !== undefined ? { nationalIdStatus: data.nationalIdStatus } : {}),
    ...(data.cardSerialNumber !== undefined ? { cardSerialNumber: data.cardSerialNumber } : {}),
    ...(data.cardStatus !== undefined ? { cardStatus: data.cardStatus } : {}),
    ...(data.cardIssueDate !== undefined ? { cardIssueDate: data.cardIssueDate } : {}),
    ...(data.cardExpiryDate !== undefined ? { cardExpiryDate: data.cardExpiryDate } : {}),
    ...(data.replacementCount !== undefined ? { replacementCount: data.replacementCount } : {}),
    ...(data.cardHistory !== undefined ? { cardHistory: data.cardHistory } : {}),
    ...(data.approvedRegistration !== undefined ? { approvedRegistration: data.approvedRegistration } : {}),
    ...(data.dateOfBirth !== undefined ? { dateOfBirth: data.dateOfBirth } : {}),
    ...(data.address !== undefined ? { address: data.address } : {}),
    ...(data.district !== undefined ? { district: data.district } : {}),
    ...(data.maritalStatus !== undefined ? { maritalStatus: data.maritalStatus } : {}),
    ...(data.center !== undefined ? { center: data.center } : {})
  };

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: userData
  });

  const fullName = data.fullName || userData.name || updatedUser.name || '';
  const citizenData = {
    fullName,
    firstName: userData.firstName ?? updatedUser.firstName ?? '',
    middleName: userData.middleName ?? updatedUser.middleName ?? '',
    lastName: userData.lastName ?? updatedUser.lastName ?? '',
    email: userData.email ?? updatedUser.email ?? null,
    phone: userData.phone ?? updatedUser.phone ?? '',
    nationalId,
    nationalIdStatus: userData.nationalIdStatus ?? updatedUser.nationalIdStatus ?? 'NOT_STARTED',
    cardSerialNumber: userData.cardSerialNumber ?? updatedUser.cardSerialNumber ?? '',
    cardStatus: userData.cardStatus ?? updatedUser.cardStatus ?? 'NOT_ISSUED',
    cardIssueDate: userData.cardIssueDate ?? updatedUser.cardIssueDate ?? null,
    cardExpiryDate: userData.cardExpiryDate ?? updatedUser.cardExpiryDate ?? null,
    replacementCount: userData.replacementCount ?? updatedUser.replacementCount ?? 0,
    cardHistory: userData.cardHistory ?? updatedUser.cardHistory ?? null,
    approvedRegistration: userData.approvedRegistration ?? updatedUser.approvedRegistration ?? null,
    dateOfBirth: userData.dateOfBirth ?? updatedUser.dateOfBirth ?? '',
    address: userData.address ?? updatedUser.address ?? '',
    district: userData.district ?? updatedUser.district ?? '',
    maritalStatus: userData.maritalStatus ?? updatedUser.maritalStatus ?? '',
    center: userData.center ?? updatedUser.center ?? null
  };

  await prisma.citizen.upsert({
    where: { userId },
    update: citizenData,
    create: { userId, ...citizenData }
  });

  return updatedUser;
};

/** After cancel/reject of a request, keep the same National ID and restore a sensible status. */
export const restoreCitizenIdStatusAfterRequestEnd = async (citizenId, { wasIssuedBefore = false } = {}) => {
  if (!citizenId) return;

  const user = await prisma.user.findUnique({
    where: { id: citizenId },
    include: { citizenProfile: true }
  });
  if (!user) return;

  const nationalId = await ensureCitizenPermanentNqsId(user);
  const currentStatus = String(user.citizenProfile?.nationalIdStatus || user.nationalIdStatus || '').toUpperCase();
  const keepIssued = wasIssuedBefore || isIssuedNationalIdStatus(currentStatus);

  const nextStatus = keepIssued ? (isIssuedNationalIdStatus(currentStatus) ? currentStatus : 'COMPLETED') : 'NOT_STARTED';

  await syncCitizenIdentityProfile(citizenId, {
    nationalId,
    nationalIdStatus: nextStatus
  });
};
