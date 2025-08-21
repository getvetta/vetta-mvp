

// components/pdfcard.tsx
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Link,
} from '@react-pdf/renderer';

type PdfCardProps = {
  dealerName: string;
  qrDataUrl: string;          // data:image/png;base64,... or https URL
  chatbotUrl: string;         // https://vetta.services/a/{dealerId}
  themeColor?: string;        // brand color (default deep blue)
  tagline?: string;           // optional subheading
  includeCutMarks?: boolean;  // show trim/crop marks for printing
  note?: string;              // small footer note (e.g., hours or contact)
};

export function PdfCard({
  dealerName,
  qrDataUrl,
  chatbotUrl,
  themeColor = '#1E3A8A',
  tagline = 'Start your quick assessment to help us match the right vehicle & terms.',
  includeCutMarks = true,
  note,
}: PdfCardProps) {
  return (
    <Document title={`${dealerName} - Vetta Assessment QR`}>
      {/* Letter size by default; set orientation="portrait" */}
      <Page size="LETTER" style={styles.page}>
        {/* Optional trim / crop marks */}
        {includeCutMarks && <CutMarks />}

        {/* Card container */}
        <View style={styles.card}>
          {/* Brand Bar */}
          <View style={[styles.brandBar, { backgroundColor: themeColor }]} />
          <View style={styles.cardContent}>
            <Text style={[styles.dealerName, { color: themeColor }]}>{dealerName}</Text>
            <Text style={styles.title}>Customer Assessment</Text>
            {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}

            {/* QR */}
            <View style={styles.qrBlock}>
              {qrDataUrl ? (
                <Image src={qrDataUrl} style={styles.qr} />
              ) : (
                <View style={styles.qrFallback}>
                  <Text style={styles.qrFallbackText}>QR unavailable</Text>
                </View>
              )}
              <Text style={styles.scanLabel}>Scan to begin</Text>
            </View>

            {/* URL fallback (clickable in PDF) */}
            <View style={styles.linkBox}>
              <Text style={styles.linkLabel}>Or visit:</Text>
              <Link src={chatbotUrl} style={[styles.linkText, { color: themeColor }]}>
                {chatbotUrl}
              </Link>
            </View>

            {/* Footer note */}
            {note ? <Text style={styles.note}>{note}</Text> : null}

            {/* Micro brand footer */}
            <Text style={styles.microBrand}>Powered by Vetta – AI Risk Assessment</Text>
          </View>
          {/* Bottom brand bar */}
          <View style={[styles.brandBar, { backgroundColor: themeColor }]} />
        </View>
      </Page>
    </Document>
  );
}

/** Small crop/trim marks for easier cutting after print */
function CutMarks() {
  return (
    <View style={styles.cutMarksContainer} fixed>
      {/* Corners */}
      <View style={[styles.cut, styles.cutTL]} />
      <View style={[styles.cut, styles.cutTR]} />
      <View style={[styles.cut, styles.cutBL]} />
      <View style={[styles.cut, styles.cutBR]} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 24, // ~0.33in margin
    backgroundColor: '#F8FAFC', // subtle off-white
  },
  card: {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    border: '1pt solid #E5E7EB',
    overflow: 'hidden',
  },
  brandBar: {
    height: 10,
  },
  cardContent: {
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  dealerName: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 6,
    color: '#0F172A', // slate-900
  },
  tagline: {
    fontSize: 12,
    color: '#475569', // slate-600
    marginBottom: 16,
  },
  qrBlock: {
    alignItems: 'center',
    marginVertical: 10,
  },
  qr: {
    width: 200,
    height: 200,
  },
  qrFallback: {
    width: 200,
    height: 200,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrFallbackText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  scanLabel: {
    marginTop: 8,
    fontSize: 12,
    color: '#334155',
  },
  linkBox: {
    marginTop: 14,
    padding: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    border: '1pt solid #E2E8F0',
  },
  linkLabel: {
    fontSize: 10,
    color: '#475569',
    marginBottom: 2,
  },
  linkText: {
    fontSize: 12,
    textDecoration: 'underline',
    wordBreak: 'break-word',
  },
  note: {
    marginTop: 12,
    fontSize: 10,
    color: '#64748B',
  },
  microBrand: {
    marginTop: 16,
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
  },

  // Cut marks
  cutMarksContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    bottom: 12,
  },
  cut: {
    position: 'absolute',
    width: 24,
    height: 24,
  },
  cutTL: {
    borderLeft: '1pt solid #CBD5E1',
    borderTop: '1pt solid #CBD5E1',
    left: 0,
    top: 0,
  },
  cutTR: {
    borderRight: '1pt solid #CBD5E1',
    borderTop: '1pt solid #CBD5E1',
    right: 0,
    top: 0,
  },
  cutBL: {
    borderLeft: '1pt solid #CBD5E1',
    borderBottom: '1pt solid #CBD5E1',
    left: 0,
    bottom: 0,
  },
  cutBR: {
    borderRight: '1pt solid #CBD5E1',
    borderBottom: '1pt solid #CBD5E1',
    right: 0,
    bottom: 0,
  },
});
