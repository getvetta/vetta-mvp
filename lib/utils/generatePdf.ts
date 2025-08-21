import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function generatePdf(qrBuffer: Buffer, link: string, dealerName: string) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([400, 600]);

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdfDoc.embedPng(qrBuffer);

  const { width, height } = page.getSize();

  page.drawText('Scan to Start Assessment', {
    x: 50,
    y: height - 50,
    size: 18,
    font,
    color: rgb(0.2, 0.2, 0.8),
  });

  page.drawImage(qrImage, {
    x: 80,
    y: height - 350,
    width: 240,
    height: 240,
  });

  page.drawText(link, {
    x: 30,
    y: 80,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText(`Dealer: ${dealerName}`, {
    x: 30,
    y: 50,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  return await pdfDoc.save();
}
