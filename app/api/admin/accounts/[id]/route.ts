import { NextRequest, NextResponse } from 'next/server';
import { accountService, AccountServiceError } from '@/services/admin/account.service';
import { AuthorizationError, requireRole } from '@/lib/auth/authorization';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/accounts/[id]: Lấy thông tin 1 tài khoản
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(request, ['admin']);
    const { id } = await params;
    const accountId = Number(id);
    if (isNaN(accountId)) {
      return NextResponse.json({ success: false, message: 'ID không hợp lệ' }, { status: 400 });
    }

    const account = await accountService.getAccountById(accountId);

    return NextResponse.json({ success: true, data: account });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    if (error instanceof AccountServiceError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, message: error?.message || 'Lỗi xử lý' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/accounts/[id]: Cập nhật thông tin tài khoản
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireRole(request, ['admin']);
    const { id } = await params;
    const accountId = Number(id);
    if (isNaN(accountId)) {
      return NextResponse.json({ success: false, message: 'ID không hợp lệ' }, { status: 400 });
    }

    const body = await request.json();
    if (currentUser.id === accountId && (body.role !== undefined || body.is_active !== undefined)) {
      return NextResponse.json(
        { success: false, message: 'Không thể tự thay đổi quyền hoặc trạng thái tài khoản đang đăng nhập' },
        { status: 409 }
      );
    }

    const updated = await accountService.updateAccount(accountId, body);

    return NextResponse.json({
      success: true,
      message: 'Cập nhật tài khoản thành công',
      data: updated,
    });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    if (error instanceof AccountServiceError) {
      return NextResponse.json(
        { success: false, message: error.message, errors: error.errors },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ success: false, message: error?.message || 'Lỗi cập nhật' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/accounts/[id]: Xóa tài khoản
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireRole(request, ['admin']);
    const { id } = await params;
    const accountId = Number(id);
    if (isNaN(accountId)) {
      return NextResponse.json({ success: false, message: 'ID không hợp lệ' }, { status: 400 });
    }


    if (currentUser.id === accountId) {
      return NextResponse.json(
        { success: false, message: 'Không thể tự xóa tài khoản đang đăng nhập' },
        { status: 409 }
      );
    }

    await accountService.deleteAccount(accountId);

    return NextResponse.json({
      success: true,
      message: 'Xóa tài khoản thành công',
    });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    if (error instanceof AccountServiceError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, message: error?.message || 'Lỗi xóa tài khoản' }, { status: 500 });
  }
}
