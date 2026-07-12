import api from '../api/axiosInstance';

const escapePdfText = (value) => String(value ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const dataUrlToBytes = (dataUrl) => {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const bytesToHex = (bytes) => {
  let hex = '';
  for (let index = 0; index < bytes.length; index += 1) {
    hex += bytes[index].toString(16).padStart(2, '0');
  }
  return `${hex}>`;
};

const convertImageToJpegDataUrl = (dataUrl, size = 260) => new Promise((resolve, reject) => {
  const image = new Image();

  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    context.drawImage(image, 0, 0, size, size);

    resolve(canvas.toDataURL('image/jpeg', 0.95));
  };

  image.onerror = () => reject(new Error('Could not prepare the QR code image for the PDF ticket.'));
  image.src = dataUrl;
});

const getQrJpegHex = async (ref) => {
  const response = await api.get(`/api/qr/generate?text=${encodeURIComponent(ref)}`);
  const qrDataUrl = response.data?.data;

  if (!response.data?.success || !qrDataUrl) {
    throw new Error('Could not generate the QR code for this ticket.');
  }

  const jpegDataUrl = await convertImageToJpegDataUrl(qrDataUrl);
  return bytesToHex(dataUrlToBytes(jpegDataUrl));
};

const buildPdf = ({ lines, qrImageHex }) => {
  const hasQrCode = Boolean(qrImageHex);
  const imageObjectId = hasQrCode ? 5 : null;
  const contentObjectId = hasQrCode ? 6 : 5;
  const pageResources = hasQrCode
    ? `/Font << /F1 4 0 R >> /XObject << /ImQR ${imageObjectId} 0 R >>`
    : '/Font << /F1 4 0 R >>';

  const textLines = [
    'BT',
    '/F1 20 Tf',
    '72 740 Td',
    '(National Queue System Ticket) Tj',
    '/F1 11 Tf',
    '0 -22 Td',
    '(National ID Appointment - Banaadir Portal) Tj',
    '/F1 12 Tf',
    '0 -36 Td',
    ...lines.flatMap((line) => [
      `(${escapePdfText(line)}) Tj`,
      '0 -22 Td'
    ]),
    'ET'
  ];

  const qrLines = hasQrCode ? [
    'BT',
    '/F1 12 Tf',
    '372 710 Td',
    '(Scan QR Ticket) Tj',
    '/F1 9 Tf',
    '0 -18 Td',
    '(QR contains ticket reference only.) Tj',
    'ET',
    'q',
    '160 0 0 160 372 520 cm',
    '/ImQR Do',
    'Q'
  ] : [
    'BT',
    '/F1 10 Tf',
    '372 710 Td',
    '(QR code unavailable.) Tj',
    'ET'
  ];

  const content = [...textLines, ...qrLines].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << ${pageResources} >> /Contents ${contentObjectId} 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];

  if (hasQrCode) {
    objects.push(`<< /Type /XObject /Subtype /Image /Width 260 /Height 260 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${qrImageHex.length} >>\nstream\n${qrImageHex}\nendstream`);
  }

  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
};

export const downloadTicketPdf = async (ticket) => {
  const ref = ticket.ref || ticket.reference || 'NQS-TICKET';
  const lines = [
    `Reference: ${ref}`,
    `Service: ${ticket.service || 'N/A'}`,
    `Center: ${ticket.center || ticket.location || 'N/A'}`,
    `Date: ${ticket.date || 'N/A'}`,
    `Time Slot: ${ticket.timeSlot || ticket.time || 'N/A'}`,
    `Estimated Wait: ${ticket.waitTime || ticket.estimatedWait || 'N/A'}`,
    `Status: ${ticket.status || 'Confirmed'}`,
    '',
    'Present this PDF ticket at the selected National ID center.'
  ];

  const qrImageHex = await getQrJpegHex(ref);
  const blob = new Blob([buildPdf({ lines, qrImageHex })], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${ref}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
