import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/models/User';
import { adminAuth } from '@/lib/firebase/admin';

// 헬퍼 함수: 요청 헤더의 Firebase JWT 토큰 검증
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

// 명세서 조건: 보안 검증된 사용자 본인의 키워드만 조회
export async function GET(req: NextRequest) {
  const decodedToken = await verifyToken(req);
  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
  }

  await dbConnect();

  try {
    let user = await User.findOne({ uid: decodedToken.uid });
    
    if (!user) {
      // 신규 유저일 경우 기본 프로필 생성
      user = await User.create({
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        keywords: [],
      });
    }
    
    return NextResponse.json({ keywords: user.keywords });
  } catch (error) {
    console.error('DB Error on GET:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// 명세서 조건: 새로운 키워드 리스트를 MongoDB 모델에 안전하게 매핑하여 업데이트
export async function POST(req: NextRequest) {
  const decodedToken = await verifyToken(req);
  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
  }

  await dbConnect();

  try {
    const body = await req.json();
    const { keywords } = body;

    if (!Array.isArray(keywords)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    // uid를 대조하여 덮어쓰기 및 없으면 신규 생성 로직(upsert)
    const updatedUser = await User.findOneAndUpdate(
      { uid: decodedToken.uid },
      { $set: { keywords, email: decodedToken.email } },
      { new: true, upsert: true }
    );

    return NextResponse.json({ keywords: updatedUser.keywords });
  } catch (error) {
    console.error('DB Error on POST:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
