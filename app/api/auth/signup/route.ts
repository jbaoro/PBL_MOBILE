import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ message: '회원가입 기능 준비 중입니다.' }, { status: 501 });
}
