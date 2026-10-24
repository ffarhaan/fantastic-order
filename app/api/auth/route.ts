import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const SMTP_USER = process.env.SMTP_USER || "ffuegoleon@gmail.com";
const SMTP_PASS = process.env.SMTP_PASS || "cigqumslcdwlyfsu";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "invite") {
      const { targetEmail, targetName, passwordHash: plainOrHash } = body;
      if (!targetEmail || !targetEmail.trim()) {
        return NextResponse.json({ error: "Target email address is missing." }, { status: 400 });
      }
      if (!SMTP_USER || !SMTP_PASS) {
        return NextResponse.json(
          { error: "Konfigurasi SMTP belum diatur di server. Hubungi Administrator." },
          { status: 500 }
        );
      }

      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      const emailSubject =
        "Aktivasi Akun FantasticOrder - Sistem Manajemen Gudang & Pelacakan Faktur";
      const emailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 24px; background-color: #ffffff; color: #1e293b; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
            <h2 style="margin: 0; color: #7c3aed; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Fantastic<span style="color: #4f46e5;">Order</span> ERP</h2>
            <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Warehouse & Invoice Tracking System</p>
          </div>
          <p style="font-size: 14px; font-weight: 600; margin-top: 0;">Yth. ${targetName},</p>
          <p style="font-size: 13px; color: #475569;">Kami ingin menginformasikan bahwa akun Anda untuk sistem <strong>FantasticOrder ERP (Sistem Manajemen Gudang & Pelacakan Faktur)</strong> telah berhasil dibuat.</p>
          <p style="font-size: 13px; color: #475569;">Anda sekarang dapat masuk ke dalam sistem untuk memantau progres faktur, retur apotek, dan dokumen pelanggan.</p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin: 24px 0; font-size: 13px;">
            <h4 style="margin: 0 0 12px 0; font-weight: 800; text-transform: uppercase; font-size: 11px; color: #64748b; letter-spacing: 0.5px;">Detail Informasi Akun Anda:</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 35%; padding: 4px 0; font-weight: 700; color: #64748b; font-size: 12px;">Alamat Email:</td>
                <td style="padding: 4px 0; font-family: monospace; font-weight: 800; color: #0f172a; font-size: 13px;">${targetEmail}</td>
              </tr>
              <tr>
                <td style="width: 35%; padding: 4px 0; font-weight: 700; color: #64748b; font-size: 12px;">Kata Sandi Awal:</td>
                <td style="padding: 4px 0; font-family: monospace; font-weight: 800; color: #0f172a; font-size: 13px;">${plainOrHash}</td>
              </tr>
              <tr>
                <td style="width: 35%; padding: 4px 0; font-weight: 700; color: #64748b; font-size: 12px;">Akses Gudang:</td>
                <td style="padding: 4px 0; font-weight: 700; color: #0f172a; font-size: 12px;">Semua Gudang (MBI & MAI)</td>
              </tr>
            </table>
          </div>
          <p style="font-size: 11px; color: #64748b; font-style: italic; background-color: #f1f5f9; padding: 10px 15px; border-radius: 10px; margin-bottom: 24px;">* Catatan: Untuk keamanan akun Anda, mohon untuk segera mengganti kata sandi Anda setelah masuk pertama kali melalui menu Pengaturan Sistem.</p>
          <p style="font-size: 13px; color: #475569; margin-bottom: 0;">Jika Anda mengalami kendala saat masuk atau memiliki pertanyaan lebih lanjut, silakan hubungi Administrator Sistem.</p>
          <p style="font-size: 13px; color: #475569; margin-top: 16px;">Terima kasih atas kerja sama Anda.</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; font-weight: 700; color: #64748b;">
            Tim FantasticOrder System<br/>
            <span style="font-size: 11px; font-weight: 600; color: #94a3b8; display: block; margin-top: 4px;">PT Medika Bina Investama & PT Medika Abadi Investama</span>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"FantasticOrder System" <${SMTP_USER}>`,
        to: targetEmail,
        subject: emailSubject,
        html: emailHtml,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Auth API error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
