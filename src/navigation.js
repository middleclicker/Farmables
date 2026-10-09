// Canvas Y grows south (+Z), while a world heading of zero points north (-Z).
export function mapArrowAngle(worldHeading) {
  return -worldHeading;
}

export function headingFromMovement(dx, dz) {
  return Math.atan2(-dx, -dz);
}
