import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: 'linear-gradient(135deg, #0F172A 0%, #11182A 55%, #1E293B 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at top right, rgba(212,175,55,0.26), transparent 28%), radial-gradient(circle at bottom left, rgba(255,255,255,0.12), transparent 24%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 54,
            left: 70,
            right: 70,
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.9), transparent)',
          }}
        />
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            padding: '84px 88px',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                color: '#D4AF37',
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: 6,
              }}
            >
              HOTAM
              <div
                style={{
                  width: 68,
                  height: 1,
                  background: 'rgba(212,175,55,0.7)',
                }}
              />
              כלי קודש מהודרים
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                textAlign: 'right',
                direction: 'rtl',
              }}
            >
              <div style={{ fontSize: 74, fontWeight: 900, lineHeight: 1.05 }}>חותם</div>
              <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.35, color: 'rgba(255,255,255,0.88)' }}>
                זירת המסחר היוקרתית לספרי תורה, תפילין, מזוזות ויודאיקה ישירות מהסופר.
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.5, color: 'rgba(255,255,255,0.7)' }}>
                שקיפות מלאה • כשרות ללא פשרות • ליווי אישי
              </div>
            </div>
          </div>

          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: 44,
              border: '2px solid rgba(212,175,55,0.42)',
              background: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 30px 80px rgba(0,0,0,0.24)',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="132" height="132" fill="none">
              <rect width="32" height="32" rx="8" fill="#11182A" />
              <g transform="translate(4,4) scale(1.0)" stroke="#D4AF37" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 19 7-7 3 3-7 7-3-3z" />
                <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="m2 2 5 5" />
                <path d="m11 11 1 1" />
              </g>
            </svg>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
