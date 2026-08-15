import { NextRequest, NextResponse } from 'next/server';
import { accountService, AccountServiceError } from '@/services/admin/account.service';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/accounts: Lấy danh sách tài khoản kèm tìm kiếm, phân trang và lọc role
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole(request, ['admin']);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const role = searchParams.get('role') || undefined;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 10;

    const result = await accountService.getAccounts({ search, role, page, limit });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Lỗi GET /api/admin/accounts:', error);
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    if (error instanceof AccountServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, message: error?.message || 'Lỗi tải danh sách tài khoản' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/accounts: Tạo tài khoản mới
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole(request, ['admin']);
    const body = await request.json();

    const newAccount = await accountService.createAccount(body);

    return NextResponse.json(
      {
        success: true,
        message: 'Tạo tài khoản mới thành công!',
        data: newAccount,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Lỗi POST /api/admin/accounts:', error);
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    if (error instanceof AccountServiceError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          errors: error.errors,
        },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Không thể tạo tài khoản',
      },
      { status: 500 }
    );
  }
}
