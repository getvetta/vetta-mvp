
import QRCode from 'qrcode';

/**
 * Generates a QR code as a Data URL.
 * @param {string} url - The URL or data to encode into a QR code.
 * @returns {Promise<string>} The QR code as a Data URL.
 */
export async function generateQrDataURL(url: string): Promise<string> {
  try {
    // Generate the QR code as a Data URL
    const qrDataURL = await QRCode.toDataURL(url);
    return qrDataURL; // Return the generated Data URL
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Failed to generate QR code");
  }
}
