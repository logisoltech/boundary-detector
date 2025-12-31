/**
 * File conversion utilities for PDF and DOCX
 * Converts documents to images for boundary detection
 * All operations are client-side only
 */

// Dynamic imports for client-side only libraries
let pdfjsLib = null;
let mammoth = null;

// Lazy load PDF.js (client-side only)
async function getPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF processing only available in browser');
  }
  
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }
  
  return pdfjsLib;
}

// Lazy load Mammoth (client-side only)
async function getMammoth() {
  if (typeof window === 'undefined') {
    throw new Error('DOCX processing only available in browser');
  }
  
  if (!mammoth) {
    const mod = await import('mammoth');
    mammoth = mod.default || mod;
  }
  
  return mammoth;
}

/**
 * Convert PDF file to array of image data URLs
 * @param {File} file - PDF file
 * @param {Object} options - Conversion options
 * @returns {Promise<Array<{dataUrl: string, pageNum: number}>>}
 */
export async function pdfToImages(file, options = {}) {
  const {
    scale = 2.0,        // Render scale (higher = better quality)
    maxPages = 10,      // Maximum pages to process
    backgroundColor = '#ffffff'
  } = options;

  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
  const numPages = Math.min(pdf.numPages, maxPages);
  const images = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    // Create canvas for rendering
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Fill background
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Render PDF page
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    images.push({
      dataUrl: canvas.toDataURL('image/png'),
      pageNum,
      width: canvas.width,
      height: canvas.height
    });
  }

  return images;
}

/**
 * Convert DOCX file to HTML and then render to image
 * @param {File} file - DOCX file
 * @param {Object} options - Conversion options
 * @returns {Promise<{dataUrl: string, html: string}>}
 */
export async function docxToImage(file, options = {}) {
  const {
    width = 800,
    padding = 40,
    backgroundColor = '#ffffff',
    textColor = '#000000',
    fontFamily = 'Georgia, serif',
    fontSize = 16
  } = options;

  const mammothLib = await getMammoth();
  const arrayBuffer = await file.arrayBuffer();
  
  // Convert DOCX to HTML using mammoth
  const result = await mammothLib.convertToHtml({ arrayBuffer });
  const html = result.value;

  // Create a temporary container to render the HTML
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: ${width}px;
    padding: ${padding}px;
    background: ${backgroundColor};
    color: ${textColor};
    font-family: ${fontFamily};
    font-size: ${fontSize}px;
    line-height: 1.6;
  `;

  // Style common elements
  const styleElements = () => {
    container.querySelectorAll('p').forEach(p => {
      p.style.marginBottom = '12px';
    });
    container.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
      h.style.marginTop = '20px';
      h.style.marginBottom = '10px';
      h.style.fontWeight = 'bold';
    });
    container.querySelectorAll('table').forEach(table => {
      table.style.borderCollapse = 'collapse';
      table.style.width = '100%';
      table.style.marginBottom = '16px';
    });
    container.querySelectorAll('td, th').forEach(cell => {
      cell.style.border = '1px solid #ccc';
      cell.style.padding = '8px';
    });
    container.querySelectorAll('ul, ol').forEach(list => {
      list.style.marginLeft = '20px';
      list.style.marginBottom = '12px';
    });
  };

  document.body.appendChild(container);
  styleElements();

  // Wait for any images to load
  await new Promise(resolve => setTimeout(resolve, 100));

  // Get the actual rendered height
  const height = container.scrollHeight;

  // Create canvas and draw
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = width + padding * 2;
  canvas.height = height;

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Render text content
  ctx.fillStyle = textColor;
  ctx.font = `${fontSize}px ${fontFamily}`;
  
  // Extract text and render line by line
  const text = container.innerText;
  const lines = wrapText(ctx, text, width - padding * 2);
  
  let y = padding + fontSize;
  lines.forEach(line => {
    ctx.fillText(line, padding, y);
    y += fontSize * 1.5;
  });

  // Clean up
  document.body.removeChild(container);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    html: result.value,
    width: canvas.width,
    height: Math.max(height, y + padding)
  };
}

/**
 * Wrap text to fit within a given width
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Load image file to HTMLImageElement
 * @param {File} file - Image file
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Load image from data URL
 * @param {string} dataUrl - Data URL
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Get file type from File object
 * @param {File} file - File to check
 * @returns {string} - 'image' | 'pdf' | 'docx' | 'unknown'
 */
export function getFileType(file) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  
  if (type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp)$/.test(name)) {
    return 'image';
  }
  
  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return 'pdf';
  }
  
  if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    return 'docx';
  }
  
  return 'unknown';
}

/**
 * Process any supported file type and return images for detection
 * @param {File} file - File to process
 * @returns {Promise<Array<{image: HTMLImageElement, source: string, pageNum?: number}>>}
 */
export async function processFile(file) {
  const fileType = getFileType(file);
  const results = [];

  switch (fileType) {
    case 'image': {
      const img = await loadImageFile(file);
      results.push({
        image: img,
        source: 'image',
        fileName: file.name
      });
      break;
    }
    
    case 'pdf': {
      const pages = await pdfToImages(file);
      for (const page of pages) {
        const img = await loadImageFromDataUrl(page.dataUrl);
        results.push({
          image: img,
          source: 'pdf',
          pageNum: page.pageNum,
          fileName: file.name
        });
      }
      break;
    }
    
    case 'docx': {
      const { dataUrl } = await docxToImage(file);
      const img = await loadImageFromDataUrl(dataUrl);
      results.push({
        image: img,
        source: 'docx',
        fileName: file.name
      });
      break;
    }
    
    default:
      throw new Error(`Unsupported file type: ${file.type || file.name}`);
  }

  return results;
}

/**
 * Get accepted file types for input element
 */
export const ACCEPTED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
].join(',');

export const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.gif,.pdf,.docx';
