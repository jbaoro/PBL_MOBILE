/** 좌표 계산 도구. 후보를 고르는 사전 단계에서만 쓰고, 화면에 보여주는 시간은 항상 실제 경로 조회 값이다. */
import type { Coordinates } from './types';

/** 두 좌표 사이 직선거리(m), 하버사인 공식 */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const lat = radians(b.lat - a.lat);
  const lng = radians(b.lng - a.lng);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(lng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

/** 여러 좌표의 단순 평균(중심점) */
export function centroid(points: Coordinates[]): Coordinates {
  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };
}
