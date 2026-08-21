import { NextRequest, NextResponse } from 'next/server';

// Basic Auth casero en el edge: el piso de acceso del ARD. Convierte "cualquiera
// con el link" en "cualquiera con el link y la credencial". Antes vivía en
// middleware.ts; Next 16 renombró la convención a proxy (misma funcionalidad).
export function proxy(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (authHeader) {
    const authValue = authHeader.split(' ')[1];
    const [user, pwd] = Buffer.from(authValue, 'base64').toString().split(':');

    if (user === process.env.BASIC_AUTH_USER && pwd === process.env.BASIC_AUTH_PASSWORD) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Autenticación requerida', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
  });
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
