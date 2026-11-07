import { NextRequest, NextResponse } from 'next/server';
import Firecrawl from '@mendable/firecrawl-js';
import { isRateLimited } from '@/lib/rate-limit';

interface ScrapeRequestBody {
  url?: string;
  urls?: string[];
  [key: string]: unknown;
}

interface ApiError extends Error {
  status?: number;
}

export async function POST(request: NextRequest) {
  const rateLimit = await isRateLimited(request, 'scrape');
  
  if (!rateLimit.success) {
    return NextResponse.json({ 
      success: false,
      error: 'Rate limit exceeded. Please try again later.' 
    }, { 
      status: 429,
      headers: {
        'X-RateLimit-Limit': rateLimit.limit.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      }
    });
  }

  // Server-side credential only — never read from request headers/browser.
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'Firecrawl is not connected. Configure FIRECRAWL_API_KEY on the server.'
    }, { status: 500 });
  }

  try {
    const app = new Firecrawl({ apiKey, origin: 'fire-enrich' });
    const body = await request.json() as ScrapeRequestBody;
    const { url, urls, ...params } = body;

    if (url && typeof url === 'string') {
      const data = await app.scrape(url, params);
      return NextResponse.json({ success: true, data });
    }

    if (urls && Array.isArray(urls)) {
      const job = await app.batchScrape(urls, params);
      return NextResponse.json({ success: true, ...job });
    }

    return NextResponse.json({ success: false, error: 'Invalid request format. Please check your input and try again.' }, { status: 400 });

  } catch (error: unknown) {
    console.error('Error in /api/scrape endpoint (SDK):', error);
    const err = error as ApiError;
    const errorStatus = typeof err.status === 'number' && err.status >= 400 ? err.status : 500;
    return NextResponse.json({ success: false, error: 'An error occurred while processing your request. Please try again later.' }, { status: errorStatus });
  }
} 