import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Bookmark from '@/lib/models/Bookmark';
import { adminAuth } from '@/lib/firebase/admin';

async function verifyToken(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// GET: 사용자가 북마크한 기사 리스트 (URL 목록 또는 전체 객체)
export async function GET(req: NextRequest) {
  const decodedToken = await verifyToken(req);
  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
  }

  await dbConnect();

  try {
    const bookmarks = await Bookmark.find({ uid: decodedToken.uid }).sort({ createdAt: -1 });
    return NextResponse.json({ bookmarks }, { status: 200 });
  } catch (error) {
    console.error('Bookmark GET error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST: 신규 북마크 추가 (또는 중복 체크)
export async function POST(req: NextRequest) {
  const decodedToken = await verifyToken(req);
  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
  }

  await dbConnect();

  try {
    const body = await req.json();
    const { url, title, description, urlToImage, publishedAt, sourceName } = body;

    if (!url || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existing = await Bookmark.findOne({ uid: decodedToken.uid, url });
    if (existing) {
      return NextResponse.json({ message: 'Already bookmarked' }, { status: 200 });
    }

    const bookmark = await Bookmark.create({
      uid: decodedToken.uid,
      url, title, description, urlToImage, publishedAt, sourceName
    });

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error) {
    console.error('Bookmark POST error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// DELETE: 북마크 삭제
export async function DELETE(req: NextRequest) {
  const decodedToken = await verifyToken(req);
  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
  }

  await dbConnect();

  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await Bookmark.findOneAndDelete({ uid: decodedToken.uid, url });
    return NextResponse.json({ message: 'Bookmark removed successfully' }, { status: 200 });
  } catch (error) {
    console.error('Bookmark DELETE error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
