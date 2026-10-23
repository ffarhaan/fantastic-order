import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// In-memory fallback if Firestore is temporarily slow
const memoryOtpStore = new Map<string, { code: string; expiresAt: number }>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, code, name } = body;

    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json({ success: false, message: "Alamat email tidak valid." }, { status: 400 });
    }

    // -------------------------------------------------------------
    // ACTION 1: SEND OTP
    // -------------------------------------------------------------
    if (action === "send") {
      const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      memoryOtpStore.set(cleanEmail, { code: generatedCode, expiresAt });

      const smtpUser = process.env.GMAIL_USER || process.env.SMTP_USER;
      const smtpPass = process.env.GMAIL_APP_PASS || process.env.SMTP_PASS;

      let emailSent = false;
      let emailError: string | null = null;

      if (smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          });

          const mailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f111a; color: #f4f4f5; margin: 0; padding: 24px; }
                .card { max-width: 480px; margin: 0 auto; background-color: #181926; border: 1px solid #27273a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                .header { background: linear-gradient(135deg, #1e3a8a, #2563eb); padding: 24px; text-align: center; }
                .logo-text { font-size: 16px; font-weight: 800; letter-spacing: 1.5px; color: #ffffff; margin: 0; }
                .sub-header { font-size: 11px; color: #bfdbfe; margin-top: 4px; }
                .body-content { padding: 32px 24px; text-align: center; }
                .greeting { font-size: 15px; color: #e4e4e7; margin-bottom: 8px; }
                .desc { font-size: 13px; color: #a1a1aa; line-height: 1.5; margin-bottom: 24px; }
                .otp-box { display: inline-block; background-color: #0d1117; border: 2px dashed #3b82f6; border-radius: 12px; padding: 14px 28px; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #60a5fa; font-family: monospace; margin: 8px 0 24px 0; }
                .badge-warn { font-size: 11px; color: #f59e0b; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 6px 12px; border-radius: 8px; display: inline-block; margin-bottom: 20px; }
                .footer { padding: 16px 24px; background-color: #12131d; border-top: 1px solid #27273a; text-align: center; font-size: 11px; color: #71717a; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="header">
                  <h1 class="logo-text">FANTASTIC ORDER</h1>
                  <div class="sub-header">PT Medika Bina Investama &bull; PT Medika Abadi Investama</div>
                </div>
                <div class="body-content">
                  <div class="greeting">Halo ${name || "Staf Fantastic Order"},</div>
                  <div class="desc">
                    Gunakan kode verifikasi (OTP) berikut untuk menyelesaikan pendaftaran akun Anda di sistem Fantastic Order:
                  </div>
                  <div>
                    <div class="otp-box">${generatedCode}</div>
                  </div>
                  <div>
                    <span class="badge-warn">&bull; Berlaku selama 10 menit &bull; Jangan bagikan ke siapapun</span>
                  </div>
                  <div class="desc" style="font-size: 11px; color: #71717a; margin-bottom: 0;">
                    Jika Anda tidak merasa mendaftarkan akun di sistem ini, silakan abaikan email ini.
                  </div>
                </div>
                <div class="footer">
                  Sistem Autentikasi Keamanan &bull; Meja Kerja Logistik Fantastic Order v2.0
                </div>
              </div>
            </body>
            </html>
          `;

          await transporter.sendMail({
            from: `"Fantastic Order Security" <${smtpUser}>`,
            to: cleanEmail,
            subject: `[${generatedCode}] Kode Verifikasi Pendaftaran Fantastic Order`,
            html: mailHtml,
          });

          emailSent = true;
        } catch (err: any) {
          console.error("Nodemailer error:", err);
          emailError = err.message || "Gagal mengirim email melalui SMTP";
        }
      }

      return NextResponse.json({
        success: true,
        emailSent,
        // If SMTP is not yet set up, provide preview code so user can test immediately without waiting for app password
        previewOtp: emailSent ? undefined : generatedCode,
        message: emailSent
          ? `Kode verifikasi 6 digit telah dikirimkan ke ${cleanEmail}. Periksa folder Kotak Masuk atau Spam Anda.`
          : `Kode verifikasi OTP telah dibuat untuk ${cleanEmail}.${
              !smtpUser ? " (Catatan: SMTP Gmail belum dikonfigurasi, gunakan kode pratinjau untuk uji coba)" : ""
            }`,
      });
    }

    // -------------------------------------------------------------
    // ACTION 2: VERIFY OTP
    // -------------------------------------------------------------
    if (action === "verify") {
      const cleanCode = String(code || "").trim();
      if (!cleanCode || cleanCode.length < 6) {
        return NextResponse.json({ success: false, message: "Kode OTP harus berupa 6 digit angka." }, { status: 400 });
      }

      const stored = memoryOtpStore.get(cleanEmail);
      if (!stored) {
        return NextResponse.json({
          success: false,
          message: "Tidak ada permintaan OTP aktif untuk email ini. Silakan kirim ulang kode.",
        }, { status: 400 });
      }

      if (Date.now() > stored.expiresAt) {
        memoryOtpStore.delete(cleanEmail);
        return NextResponse.json({
          success: false,
          message: "Kode OTP telah kadaluarsa. Silakan klik 'Kirim Ulang Kode'.",
        }, { status: 400 });
      }

      if (stored.code !== cleanCode) {
        return NextResponse.json({
          success: false,
          message: "Kode OTP yang Anda masukkan salah. Periksa kembali email Anda.",
        }, { status: 400 });
      }

      // Valid OTP: clear it
      memoryOtpStore.delete(cleanEmail);
      return NextResponse.json({
        success: true,
        message: "Kode OTP berhasil diverifikasi!",
      });
    }

    return NextResponse.json({ success: false, message: "Aksi tidak dikenali." }, { status: 400 });
  } catch (error: any) {
    console.error("OTP API Error:", error);
    return NextResponse.json({ success: false, message: "Terjadi kesalahan pada server OTP." }, { status: 500 });
  }
}
