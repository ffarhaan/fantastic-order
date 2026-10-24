import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createHmac } from "crypto";

const OTP_SECRET = process.env.AUTH_SECRET || "fantastic-order-otp-secret-2026";
const memoryOtpStore = new Map<string, { code: string; expiresAt: number }>();

function createSignedOtpToken(email: string, code: string, expiresAt: number): string {
  const payload = `${email.toLowerCase().trim()}:${code.trim()}:${expiresAt}`;
  const sig = createHmac("sha256", OTP_SECRET).update(payload).digest("hex");
  return `${expiresAt}.${sig}`;
}

function verifySignedOtpToken(email: string, code: string, token?: string): boolean {
  if (!token || !token.includes(".")) return false;
  const [expStr, sig] = token.split(".");
  const expiresAt = Number(expStr);
  if (!expiresAt || isNaN(expiresAt) || Date.now() > expiresAt) return false;
  const payload = `${email.toLowerCase().trim()}:${code.trim()}:${expiresAt}`;
  const expectedSig = createHmac("sha256", OTP_SECRET).update(payload).digest("hex");
  return sig === expectedSig;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, code, name, otpToken } = body;

    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json({ success: false, message: "Alamat email tidak valid." }, { status: 400 });
    }

    // -------------------------------------------------------------
    // ACTION 1: SEND OTP TO GMAIL (Same SMTP config as Consumable)
    // -------------------------------------------------------------
    if (action === "send") {
      const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      memoryOtpStore.set(cleanEmail, { code: generatedCode, expiresAt });
      const signedToken = createSignedOtpToken(cleanEmail, generatedCode, expiresAt);

      // Uses same Gmail SMTP credentials as Consumable app
      const smtpUser = process.env.GMAIL_USER || process.env.SMTP_USER || "ffuegoleon@gmail.com";
      const smtpPass = process.env.GMAIL_APP_PASS || process.env.SMTP_PASS || "cigqumslcdwlyfsu";

      let emailSent = false;
      let emailError: string | null = null;

      if (smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          });

          const mailHtml = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 24px; background-color: #ffffff; color: #1e293b; line-height: 1.6;">
              <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
                <h2 style="margin: 0; color: #2563eb; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">FANTASTIC <span style="color: #4f46e5;">ORDER</span></h2>
                <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Pusat Logistik Terpadu &bull; Faktur Tracker</p>
              </div>
              <p style="font-size: 14px; font-weight: 600; margin-top: 0;">Halo ${name || "Staf Fantastic Order"},</p>
              <p style="font-size: 13px; color: #475569;">Kami menerima permintaan pendaftaran akun baru di sistem <strong>Fantastic Order</strong>. Gunakan 6 digit kode verifikasi (OTP) berikut untuk mengaktifkan akun Anda:</p>
              <div style="background-color: #f8fafc; border: 2px dashed #3b82f6; border-radius: 16px; padding: 24px; margin: 24px 0; text-align: center;">
                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 1px; margin-bottom: 8px;">Kode Verifikasi OTP Anda</div>
                <div style="font-family: monospace; font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #1d4ed8;">${generatedCode}</div>
                <div style="font-size: 11px; color: #d97706; font-weight: 600; margin-top: 10px;">&bull; Kode ini berlaku selama 10 menit &bull; Jangan bagikan ke siapapun</div>
              </div>
              <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Jika Anda tidak merasa melakukan pendaftaran akun di sistem ini, silakan abaikan email ini.</p>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; font-weight: 700; color: #64748b;">
                Tim Keamanan Sistem Fantastic Order<br/>
                <span style="font-size: 11px; font-weight: 600; color: #94a3b8; display: block; margin-top: 4px;">PT Medika Bina Investama &bull; PT Medika Abadi Investama</span>
              </div>
            </div>
          `;

          await transporter.sendMail({
            from: `"Fantastic Order System" <${smtpUser}>`,
            to: cleanEmail,
            subject: `[${generatedCode}] Kode Verifikasi OTP - Fantastic Order`,
            html: mailHtml,
          });

          emailSent = true;
        } catch (err: any) {
          console.error("Nodemailer error:", err);
          emailError = err.message || "Gagal mengirim email melalui SMTP";
        }
      }

      if (!emailSent) {
        return NextResponse.json(
          {
            success: false,
            emailSent: false,
            message: `Gagal mengirim email OTP ke ${cleanEmail}: ${emailError || "Konfigurasi SMTP bermasalah"}`,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        emailSent: true,
        otpToken: signedToken,
        message: `Kode OTP 6 digit telah dikirim ke Gmail ${cleanEmail}. Silakan cek Kotak Masuk (atau folder Spam) Anda.`,
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

      // 1. Verify stateless signed HMAC token (works across all Vercel serverless instances)
      if (otpToken && verifySignedOtpToken(cleanEmail, cleanCode, otpToken)) {
        memoryOtpStore.delete(cleanEmail);
        return NextResponse.json({
          success: true,
          message: "Kode OTP berhasil diverifikasi!",
        });
      }

      // 2. Fallback to in-memory store
      const stored = memoryOtpStore.get(cleanEmail);
      if (!stored) {
        return NextResponse.json(
          {
            success: false,
            message: "Kode OTP salah atau telah kadaluarsa. Silakan periksa kembali email Anda.",
          },
          { status: 400 }
        );
      }

      if (Date.now() > stored.expiresAt) {
        memoryOtpStore.delete(cleanEmail);
        return NextResponse.json(
          {
            success: false,
            message: "Kode OTP telah kadaluarsa. Silakan klik 'Kirim Ulang Kode'.",
          },
          { status: 400 }
        );
      }

      if (stored.code !== cleanCode) {
        return NextResponse.json(
          {
            success: false,
            message: "Kode OTP yang Anda masukkan salah. Periksa kembali email Anda.",
          },
          { status: 400 }
        );
      }

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
