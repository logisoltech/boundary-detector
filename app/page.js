'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  processFile, 
  ACCEPTED_EXTENSIONS, 
  getFileType 
} from './lib/fileConverters';
import { 
  detectDocumentsEnhanced, 
  drawDetections
} from './lib/documentDetector';

// Icons as components
const UploadIcon = () => (
  <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const ImageIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const EyeIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const WarningIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

export default function Home() {
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [results, setResults] = useState(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [showIntermediate, setShowIntermediate] = useState(false);
  const [intermediateView, setIntermediateView] = useState('edges');
  const [detectionOptions, setDetectionOptions] = useState({
    showLabels: true,
    showCorners: true
  });
  
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  // Handle file selection
  const handleFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const fileType = getFileType(file);
    
    if (fileType === 'unknown') {
      alert('Unsupported file type. Please upload JPG, PNG, WebP, PDF, or DOCX files.');
      return;
    }

    setProcessing(true);
    setResults(null);
    setCurrentPageIndex(0);

    try {
      // Step 1: Process file
      setProcessingStage('Converting file...');
      const processedImages = await processFile(file);
      
      // Step 2: Detect documents in each image
      const allResults = [];
      
      for (let i = 0; i < processedImages.length; i++) {
        setProcessingStage(`Detecting boundaries (${i + 1}/${processedImages.length})...`);
        
        const { image, source, pageNum, fileName } = processedImages[i];
        
        // Run detection
        const detection = await detectDocumentsEnhanced(image, {
          enableEnhancement: true
        });
        
        allResults.push({
          image,
          source,
          pageNum,
          fileName,
          ...detection
        });
      }
      
      setResults(allResults);
      setProcessingStage('');
      
    } catch (err) {
      console.error('Processing error:', err);
      alert(`Error processing file: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  }, []);

  // Drag and drop handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileInput = useCallback((e) => {
    handleFiles(e.target.files);
  }, [handleFiles]);

  // Draw results on canvas
  useEffect(() => {
    if (!results || results.length === 0 || !canvasRef.current) return;
    
    const currentResult = results[currentPageIndex];
    if (!currentResult) return;

    const canvas = canvasRef.current;
    
    if (showIntermediate && currentResult.intermediate[intermediateView]) {
      // Show intermediate processing image
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
      };
      img.src = currentResult.intermediate[intermediateView];
    } else {
      // Show detection overlay
      drawDetections(canvas, currentResult.image, currentResult.boundaries, {
        showLabels: detectionOptions.showLabels,
        showCorners: detectionOptions.showCorners
      });
    }
  }, [results, currentPageIndex, showIntermediate, intermediateView, detectionOptions]);

  // Reset and upload new
  const handleReset = () => {
    setResults(null);
    setCurrentPageIndex(0);
    setShowIntermediate(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Load test image
  const handleTestImage = async () => {
    setProcessing(true);
    setResults(null);
    setCurrentPageIndex(0);

    try {
      // Load test image
      setProcessingStage('Loading test image...');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = '/test-document.png';
      });

      // Run detection
      setProcessingStage('Detecting boundaries...');
      const detection = await detectDocumentsEnhanced(img, {
        enableEnhancement: true
      });

      setResults([{
        image: img,
        source: 'image',
        fileName: 'test-document.png',
        ...detection
      }]);
      setProcessingStage('');
    } catch (err) {
      console.error('Test image error:', err);
      alert(`Error processing test image: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const currentResult = results?.[currentPageIndex];
  const hasMultiplePages = results && results.length > 1;

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-cyan to-accent-magenta flex items-center justify-center">
            <svg className="w-7 h-7 text-bg-primary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
              <path d="M8 12h8v2H8zm0 4h5v2H8z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-accent-cyan via-text-primary to-accent-magenta bg-clip-text text-transparent">
              DocScan
            </h1>
            <p className="text-text-muted text-sm">Document Boundary Detection</p>
          </div>
        </div>
        <p className="text-text-secondary max-w-2xl">
          Lightweight, on-device document detection using classical computer vision. 
          <span className="text-accent-cyan"> No AI, no cloud</span> — just pure image processing.
        </p>
      </header>

      <main className="max-w-6xl mx-auto">
        {/* Upload Zone - Show when no results */}
        {!results && !processing && (
          <div
            className={`upload-zone p-12 text-center cursor-pointer transition-all ${
              dragOver ? 'drag-over' : ''
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileInput}
              className="hidden"
            />
            
            <div className="flex flex-col items-center gap-6">
              <div className="text-accent-cyan opacity-60">
                <UploadIcon />
              </div>
              
              <div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">
                  Drop your document here
                </h2>
                <p className="text-text-secondary mb-4">
                  or click to browse files
                </p>
              </div>
              
              <div className="flex flex-wrap justify-center gap-3">
                {['JPG', 'PNG', 'WebP', 'PDF', 'DOCX'].map((ext) => (
                  <span
                    key={ext}
                    className="px-3 py-1 rounded-full bg-bg-tertiary border border-border text-sm text-text-muted"
                  >
                    {ext}
                  </span>
                ))}
              </div>
              
              <p className="text-text-muted text-sm max-w-md">
                Upload a photo of a document, book page, or multiple documents. 
                The app will automatically detect and outline page boundaries.
              </p>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTestImage();
                }}
                className="btn-secondary mt-4"
              >
                Try with Sample Image
              </button>
            </div>
          </div>
        )}

        {/* Processing State */}
        {processing && (
          <div className="upload-zone p-12 text-center processing-indicator">
            <div className="flex flex-col items-center gap-6">
              <div className="text-accent-cyan">
                <SpinnerIcon />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">
                  Processing...
                </h2>
                <p className="text-text-secondary">
                  {processingStage || 'Analyzing document boundaries'}
                </p>
              </div>
              <div className="w-64 h-1 bg-bg-tertiary rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-accent-cyan to-accent-magenta animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
        )}

        {/* Results View */}
        {results && currentResult && (
          <div className="space-y-6 animate-fade-in">
            {/* Controls Bar */}
            <div className="glass rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button onClick={handleReset} className="btn-secondary flex items-center gap-2">
                  <RefreshIcon />
                  <span className="hidden sm:inline">New Upload</span>
                </button>
                
                {/* Page navigation for multi-page docs */}
                {hasMultiplePages && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                      disabled={currentPageIndex === 0}
                      className="btn-secondary px-3 py-2 disabled:opacity-40"
                    >
                      ←
                    </button>
                    <span className="text-text-secondary px-2 font-mono">
                      {currentPageIndex + 1} / {results.length}
                    </span>
                    <button
                      onClick={() => setCurrentPageIndex(Math.min(results.length - 1, currentPageIndex + 1))}
                      disabled={currentPageIndex === results.length - 1}
                      className="btn-secondary px-3 py-2 disabled:opacity-40"
                    >
                      →
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                {/* Show Intermediate Toggle */}
                <div className="flex items-center gap-3">
                  <span className="text-text-muted text-sm">Debug View</span>
                  <button
                    onClick={() => setShowIntermediate(!showIntermediate)}
                    className={`toggle-switch ${showIntermediate ? 'active' : ''}`}
                    aria-label="Toggle intermediate view"
                  />
                </div>
              </div>
            </div>

            {/* Intermediate View Selector */}
            {showIntermediate && (
              <div className="glass rounded-xl p-4 animate-slide-up">
                <h3 className="text-sm font-medium text-text-muted mb-3 flex items-center gap-2">
                  <EyeIcon />
                  Processing Pipeline View
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['grayscale', 'threshold', 'edges', 'processed'].map((view) => (
                    <button
                      key={view}
                      onClick={() => setIntermediateView(view)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        intermediateView === view
                          ? 'bg-accent-cyan text-bg-primary'
                          : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {view.charAt(0).toUpperCase() + view.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Main Result Display */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Canvas Display */}
              <div className="lg:col-span-2">
                <div className="canvas-container">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-auto"
                  />
                </div>
              </div>
              
              {/* Stats Panel */}
              <div className="space-y-4">
                {/* Detection Summary */}
                <div className="glass rounded-xl p-5">
                  <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <DocumentIcon />
                    Detection Results
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Status Badge */}
                    <div className={`detection-badge ${
                      currentResult.boundaries.length > 0 ? 'success' : 'warning'
                    }`}>
                      {currentResult.boundaries.length > 0 ? (
                        <>
                          <CheckIcon />
                          {currentResult.boundaries.length} document{currentResult.boundaries.length !== 1 ? 's' : ''} detected
                        </>
                      ) : (
                        <>
                          <WarningIcon />
                          No documents detected
                        </>
                      )}
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="stats-panel">
                      <div className="stat-card">
                        <div className="stat-value">{currentResult.boundaries.length}</div>
                        <div className="stat-label">Documents</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-value">
                          {currentResult.boundaries.filter(b => b.numVertices === 4).length}
                        </div>
                        <div className="stat-label">Quadrilaterals</div>
                      </div>
                    </div>
                    
                    {/* Detected Items */}
                    {currentResult.boundaries.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-text-muted mb-2">Detected Boundaries</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {currentResult.boundaries.map((boundary, idx) => (
                            <div
                              key={idx}
                              className="bg-bg-tertiary rounded-lg p-3 text-sm"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-text-primary">
                                  {boundary.type === 'single-document' ? 'Document' :
                                   boundary.type === 'book-spread-left' ? 'Left Page' :
                                   boundary.type === 'book-spread-right' ? 'Right Page' :
                                   `Doc ${idx + 1}`}
                                </span>
                                <span className="text-accent-lime font-mono text-xs">
                                  {boundary.numVertices} pts
                                </span>
                              </div>
                              <div className="text-text-muted text-xs">
                                Area: {Math.round(boundary.area).toLocaleString()}px²
                                {boundary.isConvex && ' • Convex'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Display Options */}
                <div className="glass rounded-xl p-5">
                  <h3 className="text-sm font-medium text-text-muted mb-4">Display Options</h3>
                  
                  <div className="space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-text-secondary text-sm">Show Labels</span>
                      <button
                        onClick={() => setDetectionOptions(prev => ({
                          ...prev,
                          showLabels: !prev.showLabels
                        }))}
                        className={`toggle-switch ${detectionOptions.showLabels ? 'active' : ''}`}
                      />
                    </label>
                    
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-text-secondary text-sm">Show Corners</span>
                      <button
                        onClick={() => setDetectionOptions(prev => ({
                          ...prev,
                          showCorners: !prev.showCorners
                        }))}
                        className={`toggle-switch ${detectionOptions.showCorners ? 'active' : ''}`}
                      />
                    </label>
                  </div>
                </div>

                {/* File Info */}
                <div className="glass rounded-xl p-5">
                  <h3 className="text-sm font-medium text-text-muted mb-3 flex items-center gap-2">
                    {currentResult.source === 'image' ? <ImageIcon /> : <DocumentIcon />}
                    Source
                  </h3>
                  <div className="text-text-secondary text-sm space-y-1">
                    <p className="truncate" title={currentResult.fileName}>
                      {currentResult.fileName}
                    </p>
                    <p className="text-text-muted">
                      {currentResult.image.naturalWidth || currentResult.image.width} × {currentResult.image.naturalHeight || currentResult.image.height}px
                    </p>
                    {currentResult.pageNum && (
                      <p className="text-text-muted">Page {currentResult.pageNum}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Processing Pipeline Info */}
            <div className="glass rounded-xl p-5">
              <h3 className="text-sm font-medium text-text-muted mb-4">Classical CV Pipeline</h3>
              <div className="flex flex-wrap gap-2">
                {currentResult.stats.processingPipeline.map((step, idx) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-sm text-text-secondary">
                      {step}
                    </span>
                    {idx < currentResult.stats.processingPipeline.length - 1 && (
                      <span className="text-text-muted">→</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-text-muted text-xs mt-3">
                100% on-device processing • No data leaves your browser • No AI/ML models used
              </p>
            </div>
          </div>
        )}

        {/* Features Section - Only when no upload */}
        {!results && !processing && (
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            <div className="glass rounded-xl p-6">
              <div className="w-10 h-10 rounded-lg bg-accent-cyan/20 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-accent-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <h3 className="font-semibold text-text-primary mb-2">100% On-Device</h3>
              <p className="text-text-secondary text-sm">
                All processing happens in your browser. No images are uploaded to any server.
              </p>
            </div>
            
            <div className="glass rounded-xl p-6">
              <div className="w-10 h-10 rounded-lg bg-accent-magenta/20 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-accent-magenta" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </div>
              <h3 className="font-semibold text-text-primary mb-2">Multi-Document Support</h3>
              <p className="text-text-secondary text-sm">
                Detect single pages, book spreads, or multiple documents in a single image.
              </p>
            </div>
            
            <div className="glass rounded-xl p-6">
              <div className="w-10 h-10 rounded-lg bg-accent-lime/20 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-accent-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </div>
              <h3 className="font-semibold text-text-primary mb-2">Classical CV Only</h3>
              <p className="text-text-secondary text-sm">
                Uses edge detection, thresholding, and contour analysis — no AI or ML models.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto mt-16 pt-8 border-t border-border">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-text-muted">
          <p>
            Built with OpenCV.js • Classical Computer Vision
          </p>
          <p>
            Works on iOS, Android, and Desktop browsers
          </p>
        </div>
      </footer>
    </div>
  );
}
