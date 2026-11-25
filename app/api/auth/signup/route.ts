/**
 * POST /api/auth/signup — 준비 중(501). 현재 흐름은 로그인 없이 기기에 저장하므로 사용하지 않는다.
 * 계정·동기화 기능을 만들 때 Prisma User 모델과 함께 구현한다.
 */
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ message: '회원가입 기능 준비 중입니다.' }, { status: 501 });
}
