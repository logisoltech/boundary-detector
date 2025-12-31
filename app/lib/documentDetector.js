/**
 * Document Boundary Detector - Pure JavaScript Implementation
 * No external dependencies - uses Canvas API for image processing
 * 
 * Pipeline:
 * 1. Image preprocessing (resize, normalize)
 * 2. Grayscale conversion
 * 3. Gaussian blur (noise reduction)
 * 4. Sobel edge detection
 * 5. Thresholding
 * 6. Contour detection via flood fill
 * 7. Polygon approximation
 * 8. Boundary frame drawing
 */

/**
 * Wait for OpenCV - stub for compatibility (not needed anymore)
 */
export function waitForOpenCV() {
  return Promise.resolve(true);
}

/**
 * Main document detection function
 * @param {HTMLImageElement|HTMLCanvasElement} source - Image source
 * @param {Object} options - Detection options
 * @returns {Object} Detection results with boundaries and intermediate images
 */
export async function detectDocuments(source, options = {}) {
  const {
    minAreaRatio = 0.02,
    maxAreaRatio = 0.95,
    edgeThreshold = 50,
    blurRadius = 2,
  } = options;

  // Create canvas from source
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(source, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  
  const imageArea = width * height;
  const minArea = imageArea * minAreaRatio;
  const maxArea = imageArea * maxAreaRatio;
  
  const intermediateImages = {};
  
  // Step 1: Convert to grayscale
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i += 4) {
    const idx = i / 4;
    gray[idx] = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
  }
  intermediateImages.grayscale = arrayToDataURL(gray, width, height, 'gray');
  
  // Step 2: Apply Gaussian blur
  const blurred = gaussianBlur(gray, width, height, blurRadius);
  
  // Step 3: Sobel edge detection
  const edges = sobelEdgeDetection(blurred, width, height);
  intermediateImages.edges = arrayToDataURL(edges, width, height, 'gray');
  
  // Step 4: Adaptive threshold
  const threshold = adaptiveThreshold(blurred, width, height, 15, 5);
  intermediateImages.threshold = arrayToDataURL(threshold, width, height, 'gray');
  
  // Step 5: Combine edges and threshold
  const combined = new Uint8Array(width * height);
  for (let i = 0; i < combined.length; i++) {
    combined[i] = (edges[i] > edgeThreshold || threshold[i] > 128) ? 255 : 0;
  }
  
  // Step 6: Morphological operations (dilate then erode)
  const dilated = dilate(combined, width, height, 2);
  const processed = erode(dilated, width, height, 1);
  intermediateImages.processed = arrayToDataURL(processed, width, height, 'gray');
  
  // Step 7: Find contours
  const contours = findContours(processed, width, height);
  
  // Step 8: Filter and approximate contours
  const boundaries = [];
  
  for (const contour of contours) {
    const area = calculateContourArea(contour);
    
    if (area < minArea || area > maxArea) continue;
    
    // Get bounding box
    const bbox = getBoundingBox(contour);
    const aspectRatio = bbox.width / bbox.height;
    
    // Filter by aspect ratio (documents are typically 0.5 to 2.0)
    if (aspectRatio < 0.3 || aspectRatio > 3.5) continue;
    
    // Try multiple epsilon values to find best quadrilateral approximation
    let bestApprox = null;
    
    for (const epsilonFactor of [0.01, 0.02, 0.03, 0.04, 0.05]) {
      const epsilon = epsilonFactor * getContourPerimeter(contour);
      const approx = approximatePolygon(contour, epsilon);
      
      // Prefer 4-point approximations
      if (approx.length === 4) {
        bestApprox = approx;
        break;
      }
      
      // Accept 4-8 vertices
      if (approx.length >= 4 && approx.length <= 8) {
        if (!bestApprox || Math.abs(approx.length - 4) < Math.abs(bestApprox.length - 4)) {
          bestApprox = approx;
        }
      }
    }
    
    // If still no good approximation, try to find convex hull corners
    if (!bestApprox || bestApprox.length > 6) {
      const corners = findCorners(contour, 4);
      if (corners.length === 4) {
        bestApprox = corners;
      }
    }
    
    if (bestApprox && bestApprox.length >= 4 && bestApprox.length <= 8) {
      // Order points for quadrilaterals
      const orderedPoints = bestApprox.length === 4 ? orderQuadPoints(bestApprox) : bestApprox;
      
      boundaries.push({
        points: orderedPoints,
        area,
        aspectRatio,
        numVertices: bestApprox.length,
        boundingRect: bbox,
        isConvex: isConvex(orderedPoints),
      });
    }
  }
  
  // Sort by area (largest first)
  boundaries.sort((a, b) => b.area - a.area);
  
  // Filter overlapping
  const filtered = filterOverlapping(boundaries, 0.5);
  
  // Classify detections
  classifyDetections(filtered);
  
  return {
    boundaries: filtered,
    intermediate: intermediateImages,
    stats: {
      totalDetected: filtered.length,
      processingPipeline: ['grayscale', 'blur', 'edges', 'threshold', 'contours', 'filter']
    }
  };
}

/**
 * Gaussian blur implementation
 */
function gaussianBlur(data, width, height, radius) {
  const kernel = createGaussianKernel(radius);
  const kSize = kernel.length;
  const half = Math.floor(kSize / 2);
  const result = new Uint8Array(width * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let weightSum = 0;
      
      for (let ky = 0; ky < kSize; ky++) {
        for (let kx = 0; kx < kSize; kx++) {
          const px = Math.min(Math.max(x + kx - half, 0), width - 1);
          const py = Math.min(Math.max(y + ky - half, 0), height - 1);
          const weight = kernel[ky][kx];
          sum += data[py * width + px] * weight;
          weightSum += weight;
        }
      }
      
      result[y * width + x] = Math.round(sum / weightSum);
    }
  }
  
  return result;
}

function createGaussianKernel(radius) {
  const size = radius * 2 + 1;
  const kernel = [];
  const sigma = radius / 2;
  
  for (let y = 0; y < size; y++) {
    kernel[y] = [];
    for (let x = 0; x < size; x++) {
      const dx = x - radius;
      const dy = y - radius;
      kernel[y][x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
    }
  }
  
  return kernel;
}

/**
 * Sobel edge detection
 */
function sobelEdgeDetection(data, width, height) {
  const result = new Uint8Array(width * height);
  
  const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
  const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = data[(y + ky) * width + (x + kx)];
          gx += pixel * sobelX[ky + 1][kx + 1];
          gy += pixel * sobelY[ky + 1][kx + 1];
        }
      }
      
      result[y * width + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }
  
  return result;
}

/**
 * Adaptive thresholding
 */
function adaptiveThreshold(data, width, height, blockSize, C) {
  const result = new Uint8Array(width * height);
  const half = Math.floor(blockSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px >= 0 && px < width && py >= 0 && py < height) {
            sum += data[py * width + px];
            count++;
          }
        }
      }
      
      const mean = sum / count;
      const pixel = data[y * width + x];
      result[y * width + x] = pixel < (mean - C) ? 255 : 0;
    }
  }
  
  return result;
}

/**
 * Morphological dilate
 */
function dilate(data, width, height, radius) {
  const result = new Uint8Array(width * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let max = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px >= 0 && px < width && py >= 0 && py < height) {
            max = Math.max(max, data[py * width + px]);
          }
        }
      }
      result[y * width + x] = max;
    }
  }
  
  return result;
}

/**
 * Morphological erode
 */
function erode(data, width, height, radius) {
  const result = new Uint8Array(width * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let min = 255;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px >= 0 && px < width && py >= 0 && py < height) {
            min = Math.min(min, data[py * width + px]);
          }
        }
      }
      result[y * width + x] = min;
    }
  }
  
  return result;
}

/**
 * Find contours using boundary tracing
 */
function findContours(data, width, height) {
  const visited = new Uint8Array(width * height);
  const contours = [];
  
  // Moore neighborhood (8-connected)
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      
      // Look for edge pixels (white pixel with black neighbor on left)
      if (data[idx] === 255 && !visited[idx] && data[idx - 1] === 0) {
        const contour = traceContour(data, visited, width, height, x, y, dx, dy);
        if (contour.length >= 20) { // Minimum points
          contours.push(contour);
        }
      }
    }
  }
  
  return contours;
}

/**
 * Trace a single contour using Moore-Neighbor algorithm
 */
function traceContour(data, visited, width, height, startX, startY, dx, dy) {
  const contour = [];
  let x = startX;
  let y = startY;
  let dir = 0; // Start direction
  
  const maxIterations = width * height;
  let iterations = 0;
  
  do {
    contour.push({ x, y });
    visited[y * width + x] = 1;
    
    // Find next boundary pixel
    let found = false;
    const startDir = (dir + 6) % 8; // Start from previous direction - 2
    
    for (let i = 0; i < 8; i++) {
      const checkDir = (startDir + i) % 8;
      const nx = x + dx[checkDir];
      const ny = y + dy[checkDir];
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        if (data[ny * width + nx] === 255) {
          x = nx;
          y = ny;
          dir = checkDir;
          found = true;
          break;
        }
      }
    }
    
    if (!found) break;
    iterations++;
    
  } while ((x !== startX || y !== startY) && iterations < maxIterations);
  
  return contour;
}

/**
 * Calculate contour area using Shoelace formula
 */
function calculateContourArea(contour) {
  let area = 0;
  const n = contour.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += contour[i].x * contour[j].y;
    area -= contour[j].x * contour[i].y;
  }
  
  return Math.abs(area / 2);
}

/**
 * Get contour perimeter
 */
function getContourPerimeter(contour) {
  let perimeter = 0;
  const n = contour.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = contour[j].x - contour[i].x;
    const dy = contour[j].y - contour[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  
  return perimeter;
}

/**
 * Get bounding box of contour
 */
function getBoundingBox(contour) {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  for (const p of contour) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Douglas-Peucker polygon approximation
 */
function approximatePolygon(contour, epsilon) {
  if (contour.length < 3) return contour;
  
  // Find the point with max distance from line between first and last
  let maxDist = 0;
  let maxIdx = 0;
  const first = contour[0];
  const last = contour[contour.length - 1];
  
  for (let i = 1; i < contour.length - 1; i++) {
    const dist = pointToLineDistance(contour[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }
  
  if (maxDist > epsilon) {
    const left = approximatePolygon(contour.slice(0, maxIdx + 1), epsilon);
    const right = approximatePolygon(contour.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  
  return [first, last];
}

/**
 * Distance from point to line
 */
function pointToLineDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  
  if (len === 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + 
      Math.pow(point.y - lineStart.y, 2)
    );
  }
  
  const t = Math.max(0, Math.min(1, 
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (len * len)
  ));
  
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  
  return Math.sqrt(
    Math.pow(point.x - projX, 2) + 
    Math.pow(point.y - projY, 2)
  );
}

/**
 * Find corner points using curvature analysis
 */
function findCorners(contour, numCorners = 4) {
  if (contour.length < numCorners * 2) return [];
  
  // Sample points at regular intervals
  const step = Math.max(1, Math.floor(contour.length / 100));
  const sampledPoints = [];
  for (let i = 0; i < contour.length; i += step) {
    sampledPoints.push({ ...contour[i], originalIdx: i });
  }
  
  // Calculate curvature at each point
  const curvatures = [];
  const windowSize = Math.max(3, Math.floor(sampledPoints.length / 20));
  
  for (let i = 0; i < sampledPoints.length; i++) {
    const prev = sampledPoints[(i - windowSize + sampledPoints.length) % sampledPoints.length];
    const curr = sampledPoints[i];
    const next = sampledPoints[(i + windowSize) % sampledPoints.length];
    
    // Calculate angle
    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    
    const dot = v1x * v2x + v1y * v2y;
    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
    
    if (len1 > 0 && len2 > 0) {
      const cos = Math.max(-1, Math.min(1, dot / (len1 * len2)));
      const angle = Math.acos(cos);
      curvatures.push({ point: curr, curvature: Math.PI - angle, idx: i });
    }
  }
  
  // Sort by curvature (highest first = sharpest corners)
  curvatures.sort((a, b) => b.curvature - a.curvature);
  
  // Select top corners with minimum distance between them
  const corners = [];
  const minDist = Math.min(
    getBoundingBox(contour).width,
    getBoundingBox(contour).height
  ) * 0.2;
  
  for (const c of curvatures) {
    let tooClose = false;
    for (const corner of corners) {
      const dx = c.point.x - corner.x;
      const dy = c.point.y - corner.y;
      if (Math.sqrt(dx * dx + dy * dy) < minDist) {
        tooClose = true;
        break;
      }
    }
    
    if (!tooClose) {
      corners.push(c.point);
      if (corners.length >= numCorners) break;
    }
  }
  
  return corners;
}

/**
 * Order quadrilateral points: top-left, top-right, bottom-right, bottom-left
 */
function orderQuadPoints(points) {
  if (points.length !== 4) return points;
  
  // Find centroid
  const cx = points.reduce((sum, p) => sum + p.x, 0) / 4;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / 4;
  
  // Sort by angle from centroid
  const sorted = [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });
  
  // Find top-left (smallest x + y sum)
  let minSum = Infinity;
  let startIdx = 0;
  for (let i = 0; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < minSum) {
      minSum = sum;
      startIdx = i;
    }
  }
  
  // Reorder starting from top-left
  const ordered = [];
  for (let i = 0; i < 4; i++) {
    ordered.push(sorted[(startIdx + i) % 4]);
  }
  
  return ordered;
}

/**
 * Check if polygon is convex
 */
function isConvex(points) {
  if (points.length < 3) return false;
  
  let sign = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    
    const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
    
    if (cross !== 0) {
      if (sign === 0) {
        sign = cross > 0 ? 1 : -1;
      } else if ((cross > 0 ? 1 : -1) !== sign) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Filter overlapping detections
 */
function filterOverlapping(boundaries, iouThreshold) {
  const selected = [];
  const used = new Set();
  
  for (let i = 0; i < boundaries.length; i++) {
    if (used.has(i)) continue;
    
    selected.push(boundaries[i]);
    
    for (let j = i + 1; j < boundaries.length; j++) {
      if (used.has(j)) continue;
      
      const iou = calculateIoU(
        boundaries[i].boundingRect,
        boundaries[j].boundingRect
      );
      
      if (iou > iouThreshold) {
        used.add(j);
      }
    }
  }
  
  return selected;
}

/**
 * Calculate IoU
 */
function calculateIoU(rect1, rect2) {
  const x1 = Math.max(rect1.x, rect2.x);
  const y1 = Math.max(rect1.y, rect2.y);
  const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
  const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);
  
  if (x1 >= x2 || y1 >= y2) return 0;
  
  const intersection = (x2 - x1) * (y2 - y1);
  const area1 = rect1.width * rect1.height;
  const area2 = rect2.width * rect2.height;
  const union = area1 + area2 - intersection;
  
  return intersection / union;
}

/**
 * Classify detections
 */
function classifyDetections(boundaries) {
  if (boundaries.length === 0) return;
  
  // Check for book spread
  if (boundaries.length >= 2) {
    const sorted = [...boundaries].sort((a, b) => 
      a.boundingRect.x - b.boundingRect.x
    );
    
    for (let i = 0; i < sorted.length - 1; i++) {
      const left = sorted[i];
      const right = sorted[i + 1];
      
      const gap = right.boundingRect.x - (left.boundingRect.x + left.boundingRect.width);
      const avgWidth = (left.boundingRect.width + right.boundingRect.width) / 2;
      const heightDiff = Math.abs(left.boundingRect.height - right.boundingRect.height);
      const avgHeight = (left.boundingRect.height + right.boundingRect.height) / 2;
      
      if (gap < avgWidth * 0.3 && heightDiff < avgHeight * 0.3) {
        left.type = 'book-spread-left';
        right.type = 'book-spread-right';
      }
    }
  }
  
  for (const boundary of boundaries) {
    if (!boundary.type) {
      boundary.type = boundaries.length === 1 ? 'single-document' : 'document';
    }
  }
}

/**
 * Convert array to data URL
 */
function arrayToDataURL(data, width, height, mode = 'gray') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  
  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    imageData.data[i * 4] = val;
    imageData.data[i * 4 + 1] = val;
    imageData.data[i * 4 + 2] = val;
    imageData.data[i * 4 + 3] = 255;
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Draw detection results on canvas
 */
export function drawDetections(canvas, image, boundaries, options = {}) {
  const {
    strokeWidth = 3,
    cornerRadius = 8,
    showLabels = true,
    showCorners = true,
    colors = {
      'single-document': '#00d4ff',
      'document': '#a3ff12',
      'book-spread-left': '#ff006e',
      'book-spread-right': '#ff006e',
    },
    fillOpacity = 0.1,
  } = options;
  
  const ctx = canvas.getContext('2d');
  
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  
  ctx.drawImage(image, 0, 0);
  
  boundaries.forEach((boundary, index) => {
    const color = colors[boundary.type] || colors['document'];
    const points = boundary.points;
    
    // Draw filled polygon
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    
    // Fill
    ctx.fillStyle = hexToRgba(color, fillOpacity);
    ctx.fill();
    
    // Stroke
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // Corners
    if (showCorners) {
      points.forEach((point, i) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, cornerRadius + 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(point.x, point.y, cornerRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((i + 1).toString(), point.x, point.y);
      });
    }
    
    // Label
    if (showLabels) {
      const labelText = getLabelText(boundary, index);
      const labelX = boundary.boundingRect.x;
      const labelY = boundary.boundingRect.y - 10;
      
      ctx.font = 'bold 14px sans-serif';
      const metrics = ctx.measureText(labelText);
      const padding = 6;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(
        labelX - padding,
        labelY - 14 - padding,
        metrics.width + padding * 2,
        18 + padding
      );
      
      ctx.fillStyle = color;
      ctx.fillText(labelText, labelX, labelY);
    }
  });
  
  return canvas;
}

function getLabelText(boundary, index) {
  switch (boundary.type) {
    case 'single-document': return 'Document';
    case 'book-spread-left': return 'Left Page';
    case 'book-spread-right': return 'Right Page';
    default: return `Doc ${index + 1}`;
  }
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Enhanced detection with multiple strategies
 */
export async function detectDocumentsEnhanced(source, baseOptions = {}) {
  const strategies = [
    { ...baseOptions },
    { ...baseOptions, edgeThreshold: 30, minAreaRatio: 0.03 },
    { ...baseOptions, edgeThreshold: 70, blurRadius: 3 },
    { ...baseOptions, minAreaRatio: 0.01, maxAreaRatio: 0.98 },
  ];
  
  let bestResult = { boundaries: [], intermediate: {}, stats: {} };
  let maxQuads = 0;
  
  for (const strategy of strategies) {
    try {
      const result = await detectDocuments(source, strategy);
      
      const quads = result.boundaries.filter(b => b.numVertices === 4);
      if (quads.length > maxQuads) {
        maxQuads = quads.length;
        bestResult = result;
      }
      
      if (quads.length > 0) {
        bestResult = result;
        break;
      }
      
      if (result.boundaries.length > bestResult.boundaries.length) {
        bestResult = result;
      }
    } catch (e) {
      console.warn('Strategy failed:', e);
    }
  }
  
  return bestResult;
}
