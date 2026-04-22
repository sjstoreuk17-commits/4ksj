import { XtreamSeries, XtreamStream } from '../types';

export class PosterGenerator {
  static async generateCollage(
    items: (any)[], 
    type: 'movie' | 'series',
    onProgress?: (msg: string) => void
  ): Promise<string> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // Configuration for the 2:3 Aspect Ratio (Portrait)
    const targetWidth = 2000;
    const targetHeight = 3000; // 2:3 Ratio (2000 * 1.5)
    
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const columns = items.length <= 3 ? 2 : (items.length <= 8 ? 3 : 4);
    const rows = Math.ceil(items.length / columns);
    
    // Dynamic Scaling to fit the 2:3 frame
    const padding = 80;
    const headerHeight = 280;
    const footerSpace = 100;
    
    const availableWidth = targetWidth - (padding * 2);
    const availableHeight = targetHeight - headerHeight - footerSpace - (padding * 2);
    
    const posterWidth = (availableWidth - (columns - 1) * padding) / columns;
    const posterHeight = posterWidth * 1.5; // Maintain 2:3 for individual posters too
    const textSpace = 140;

    // Total content height to check if we need to scale down
    const rowHeight = posterHeight + textSpace + padding;
    const totalContentHeight = rows * rowHeight;
    
    let scale = 1;
    if (totalContentHeight > availableHeight) {
        scale = availableHeight / totalContentHeight;
    }

    const finalPosterWidth = posterWidth * scale;
    const finalPosterHeight = posterHeight * scale;
    const finalTextSpace = textSpace * scale;
    const finalPadding = padding * scale;

    // Gradient Background - Cinematic Mesh Style
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, '#020617'); // slate-950
    bgGradient.addColorStop(0.5, '#0f172a'); // slate-900
    bgGradient.addColorStop(1, '#020617'); 
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle Mesh Glows (Cinematic Depth)
    const drawGlow = (gx: number, gy: number, color: string) => {
        const grd = ctx.createRadialGradient(gx, gy, 0, gx, gy, 800);
        grd.addColorStop(0, color);
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.globalCompositeOperation = 'screen';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
    };
    drawGlow(0, 0, 'rgba(30, 58, 138, 0.2)'); 
    drawGlow(canvas.width, canvas.height, 'rgba(79, 70, 229, 0.1)');

    // Draw Header
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 0, canvas.width, headerHeight);
    
    // Header Accent Line
    ctx.fillStyle = '#6366f1'; 
    ctx.fillRect(canvas.width/4, headerHeight - 3, canvas.width/2, 3);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 80px "Inter", sans-serif'; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '6px';
    const headerTitle = type === 'series' 
      ? 'RECENTLY ADDED WEB SERIES ON OUR SERVER' 
      : 'RECENTLY ADDED MOVIES ON OUR SERVER';
    ctx.fillText(headerTitle, canvas.width / 2, headerHeight / 2);
    
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(padding, headerHeight);
    ctx.lineTo(canvas.width - padding, headerHeight);
    ctx.stroke();

    const borderRadius = 20;

    // Load and Draw Posters
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const col = i % columns;
        const row = Math.floor(i / columns);
        
        // --- CENTERING LOGIC FOR EACH ROW ---
        const itemsInThisRow = Math.min(columns, items.length - row * columns);
        const rowWidth = itemsInThisRow * finalPosterWidth + (itemsInThisRow - 1) * finalPadding;
        const rowStartX = (canvas.width - rowWidth) / 2;
        
        const x = rowStartX + col * (finalPosterWidth + finalPadding);
        const y = headerHeight + finalPadding + row * (finalPosterHeight + finalTextSpace + finalPadding);
        const itemName = (item.name || 'UNKNOWN').toString().trim();

        onProgress?.(`SYNCHRONIZING: ${itemName}...`);

        // Metadata Calculation - Super Robust logic to avoid ID mixup
        let meta = '';
        if (type === 'series') {
            // Priority 1: final_episode_count (passed from App.tsx registry)
            // Priority 2: Standard fields, filtered to avoid IDs
            const countFromFields = [
                (item as any).final_episode_count,
                item.num_episodes, 
                item.total_episodes, 
                item.episode_count, 
                item.total_eps, 
                item.episodes_count,
            ].map(v => parseInt(v)).filter(v => !isNaN(v) && v > 0 && v < 10000);

            const count = countFromFields.length > 0 ? countFromFields[0] : null;
            meta = count ? `${count} EPISODES` : 'SERIES_DATA_PENDING';
        } else {
            meta = (item as any).genre || (item as any).category_name || (item as any).releaseDate || 'ULTRA_HD_FEATURE';
        }

        // Cinematic Background Glow for Posters
        const glowGrd = ctx.createRadialGradient(x + finalPosterWidth/2, y + finalPosterHeight/2, 0, x + finalPosterWidth/2, y + finalPosterHeight/2, finalPosterHeight);
        glowGrd.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
        glowGrd.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrd;
        ctx.fillRect(x - finalPosterWidth/2, y - finalPosterHeight/2, finalPosterWidth * 2, finalPosterHeight * 2);

        // Draw Poster Box Background (Placeholder)
        ctx.fillStyle = '#0a0a0a'; 
        this.roundRect(ctx, x, y, finalPosterWidth, finalPosterHeight, borderRadius);
        ctx.fill();

        try {
            const rawUrl = item.cover || item.stream_icon || item.movie_image || '';
            if (rawUrl && rawUrl.startsWith('http')) {
                const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(rawUrl)}&w=600&h=900&fit=cover&output=jpg&q=90&errorRedirect=https://placehold.co/600x900/1e293b/ffffff?text=NO_IMAGE`;
                const img = await this.loadImage(proxyUrl);

                // Premium Shadows & Glow
                ctx.save();
                ctx.shadowColor = 'rgba(0,0,0,1)';
                ctx.shadowBlur = 60;
                ctx.shadowOffsetY = 40;

                // Border Highlight
                this.roundRect(ctx, x, y, finalPosterWidth, finalPosterHeight, borderRadius);
                ctx.clip();
                ctx.drawImage(img, x, y, finalPosterWidth, finalPosterHeight);
                
                // Netflix Layer: Dark gradient on poster bottom
                const overlayGrd = ctx.createLinearGradient(x, y + finalPosterHeight * 0.6, x, y + finalPosterHeight);
                overlayGrd.addColorStop(0, 'transparent');
                overlayGrd.addColorStop(1, 'rgba(0,0,0,0.9)');
                ctx.fillStyle = overlayGrd;
                ctx.fillRect(x, y + finalPosterHeight * 0.6, finalPosterWidth, finalPosterHeight * 0.4);
                
                ctx.restore();

                // Outer Frame Glow (Subtle)
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 2;
                this.roundRect(ctx, x, y, finalPosterWidth, finalPosterHeight, borderRadius);
                ctx.stroke();
            } else {
                throw new Error('No valid URL');
            }
        } catch (err) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('NO POSTER DATA', x + finalPosterWidth/2, y + finalPosterHeight/2);
        }

        // --- CINEMATIC TEXT DESIGN ---
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const textXOffset = x + finalPosterWidth / 2;
        
        // Premium Title Stack
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 44px Inter, sans-serif';
        // Add subtle text shadow for clarity
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 6;
        this.wrapText(ctx, itemName.toUpperCase(), textXOffset, y + finalPosterHeight + 35, finalPosterWidth, 52);

        // Metadata: Netflix/Prime style Badge font
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#f43f5e'; // Vibrant Rose/Red like Netflix UI
        ctx.font = '900 30px "Inter", sans-serif';
        ctx.letterSpacing = '2px';
        ctx.fillText(meta.toUpperCase(), textXOffset, y + finalPosterHeight + 145);
        
        // Minimalist Divider Line
        ctx.fillStyle = 'rgba(244, 63, 94, 0.5)';
        ctx.fillRect(textXOffset - 60, y + finalPosterHeight + 195, 120, 3);
    }

    return canvas.toDataURL('image/jpeg', 0.9);
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
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private static wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(' ');
    let line = '';
    let testY = y;

    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      let testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, testY);
        line = words[n] + ' ';
        testY += lineHeight;
        if (testY > y + lineHeight) break; // Hard limit 2 lines
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, testY);
  }
}
