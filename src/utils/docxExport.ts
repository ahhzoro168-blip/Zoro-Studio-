import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { downloadFile } from './srtParser';

export interface DocxParagraphItem {
  id: number | string;
  sourceText: string;
  translatedText: string;
}

/**
 * Generates a standard .docx Word document containing the translated or bilingual text
 */
export async function exportToDocx(
  items: DocxParagraphItem[],
  filename = 'translated_document.docx',
  mode: 'translated' | 'bilingual' | 'original' = 'translated',
  title = 'Translated Document (LinguaKhmer AI)'
): Promise<void> {
  const children: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated via LinguaKhmer AI Studio • ${new Date().toLocaleDateString()}`,
          italics: true,
          size: 20, // 10pt
          color: '666666',
        }),
      ],
      spacing: { after: 400 },
    }),
  ];

  for (const item of items) {
    if (mode === 'translated') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: item.translatedText || item.sourceText,
              font: 'Kantumruy Pro',
              size: 24, // 12pt
            }),
          ],
          spacing: { after: 200, line: 360 }, // Generous line spacing for Khmer scripts
        })
      );
    } else if (mode === 'bilingual') {
      // Bilingual presentation: Source text above in subtle color, Khmer translation below
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: item.sourceText,
              italics: true,
              color: '555555',
              size: 22,
            }),
          ],
          spacing: { before: 120, after: 60 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: item.translatedText || '',
              bold: true,
              font: 'Kantumruy Pro',
              size: 24,
            }),
          ],
          spacing: { after: 240, line: 360 },
        })
      );
    } else {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: item.sourceText,
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadFile(blob, filename.endsWith('.docx') ? filename : `${filename}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
