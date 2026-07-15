import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function esc(v: string): string {
  // Neutralize CSV/formula injection: a donor-supplied name/message starting with
  // = + - @ could execute in Excel/Sheets. Prefix with a quote to force text.
  const s = /^[=+\-@]/.test(v) ? `'${v}` : v
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const rows = await prisma.contribution.findMany({
    orderBy: { createdAt: 'desc' },
    include: { registryItem: { select: { title: true } } },
  })
  const header = ['Name', 'Email', 'Gift', 'Amount', 'Message', 'Thank-you sent', 'Date']
  const lines = [header.join(',')]
  for (const c of rows) {
    lines.push([
      esc(c.contributorName), esc(c.contributorEmail), esc(c.registryItem?.title ?? '—'),
      Number(c.amount).toFixed(2), esc(c.message ?? ''), c.thankYouSent ? 'Yes' : 'No',
      new Date(c.createdAt).toLocaleDateString('en-US'),
    ].join(','))
  }
  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="registry-contributions.csv"` },
  })
}
