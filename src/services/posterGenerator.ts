export class PosterGenerator {
  static async generateCollage(
    items: (any)[], 
    type: 'movie' | 'series',
    onProgress?: (msg: string) => void
  ): Promise<string> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // CONFIGURATION
    const columns = 4; // Standard OTT grid width
    const rows = Math.ceil(items.length / columns);
    const posterWidth = 480; // Large fixed width for high quality
    const posterHeight = 720; // Exact 2:3 Ratio
    const padding = 20; // Minimal grid gap for "Edge-to-Edge" feel
    const horizontalMargin = 60;
    const verticalMarginTop = 220; // Space for Header
    const verticalMarginBottom = 100;

    // DYNAMIC CANVAS SCALING
    // We calculate height based on rows so posters NEVER shrink
    canvas.width = (posterWidth * columns) + (padding * (columns - 1)) + (horizontalMargin * 2);
    canvas.height = (posterHeight * rows) + (padding * (rows - 1)) + verticalMarginTop + verticalMarginBottom;

    // 1. BACKGROUND: Deep Cinema Navy
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, '#020617'); 
    bgGradient.addColorStop(0.5, '#01040a'); 
    bgGradient.addColorStop(1, '#020617'); 
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. HEADER: Dynamic & Elegant
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(0, 0, canvas.width, verticalMarginTop - 20);
    
    const headerTitle = type === 'series' 
      ? 'RECENTLY ADDED WEB SERIES' 
      : 'RECENTLY ADDED MOVIES';
    
    ctx.font = 'bold 90px "Inter", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '5px';
    ctx.fillText(headerTitle.toUpperCase(), canvas.width / 2, (verticalMarginTop - 20) / 2);

    // Header Accent Line
    ctx.fillStyle = '#6366f1'; 
    ctx.fillRect(canvas.width/3, verticalMarginTop - 40, canvas.width/3, 5);

    // 3. RENDER POSTERS
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const col = i % columns;
        const row = Math.floor(i / columns);
        
        const x = horizontalMargin + col * (posterWidth + padding);
        const y = verticalMarginTop + row * (posterHeight + padding);
        
        // Robust Metadata Extraction
        const itemName = (item.name || item.title || item.stream_name || item.displayName || 'UNKNOWN_ITEM').toString().trim();
        const itemCategory = (item.category_name || '').toString().trim();
        const rawUrl = item.cover || item.stream_icon || item.movie_image || item.icon || item.thumbnail || '';

        onProgress?.(`EXPORTING: ${itemName.substring(0, 20)}...`);

        // 1. Poster Container (Skeleton)
        ctx.fillStyle = '#0f172a'; // Deep slate base
        this.roundRect(ctx, x, y, posterWidth, posterHeight, 15);
        ctx.fill();

        try {
            if (rawUrl && rawUrl.startsWith('http')) {
                // Primary Proxy: Weserv (Resized & CORS handled)
                const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(rawUrl)}&w=600&h=900&fit=cover&output=jpg&q=95`;
                
                let img: HTMLImageElement;
                try {
                    img = await this.loadImage(proxyUrl);
                } catch (e) {
                    // Fallback to direct URL if Proxy fails
                    onProgress?.(`IMAGE_PROXY_FAIL: [${itemName.substring(0, 15)}]...`);
                    img = await this.loadImage(rawUrl);
                }

                // DRAW POSTER
                ctx.save();
                this.roundRect(ctx, x, y, posterWidth, posterHeight, 15);
                ctx.clip();
                ctx.drawImage(img, x, y, posterWidth, posterHeight);
                ctx.restore();
            } else {
                throw new Error('NO_VALID_URL');
            }
        } catch (err) {
            // Draw a subtle placeholder icon since image failed
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.textAlign = 'center';
            ctx.font = 'bold 80px "Inter"';
            ctx.fillText('?', x + posterWidth/2, y + posterHeight/2);
        }

        // 2. GRADIENT OVERLAY (Always applied for text readability)
        const overlayGrd = ctx.createLinearGradient(x, y + posterHeight * 0.4, x, y + posterHeight);
        overlayGrd.addColorStop(0, 'transparent');
        overlayGrd.addColorStop(0.7, 'rgba(0,0,0,0.85)');
        overlayGrd.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = overlayGrd;
        ctx.fillRect(x, y + posterHeight * 0.4, posterWidth, posterHeight * 0.6);

        // 3. TEXT LAYERING (Always applied)
        ctx.textAlign = 'center';
        
        // --- CATEGORY BADGE ---
        if (itemCategory) {
            ctx.font = '800 24px "Inter", sans-serif';
            ctx.fillStyle = '#6366f1'; 
            this.wrapText(ctx, itemCategory.toUpperCase(), x + posterWidth / 2, y + posterHeight - 125, posterWidth - 60, 28, 2);
        }

        // --- TITLE ---
        ctx.font = 'bold 38px "Inter", sans-serif';
        ctx.fillStyle = '#ffffff';
        this.wrapText(ctx, itemName.toUpperCase(), x + posterWidth / 2, y + posterHeight - 65, posterWidth - 40, 44, 2);

        // 4. BORDER HIGHLIGHT
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, x, y, posterWidth, posterHeight, 15);
        ctx.stroke();
    }

    try {
        return canvas.toDataURL('image/jpeg', 0.95);
    } catch (e) {
        onProgress?.("EXPORT_SECURITY_BLOCK: SOME_POSTERS_RESTRICTED");
        throw new Error("POSTER_SECURITY_CONSTRAINT: Some images have security restrictions that blocked the high-quality export. This usually happens with localized IPTV posters. Try selecting different items.");
    }
  }

  private static loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = url;
    });
  }

  private static roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private static wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number = 2) {
    const words = text.split(' ');
    let line = '';
    let testY = y;
    let linesDrawn = 0;

    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, testY);
        line = words[n] + ' ';
        testY += lineHeight;
        linesDrawn++;
        if (linesDrawn >= maxLines) break;
      } else {
        line = testLine;
      }
    }
    if (linesDrawn < maxLines) {
        ctx.fillText(line, x, testY);
    }
  }
}
