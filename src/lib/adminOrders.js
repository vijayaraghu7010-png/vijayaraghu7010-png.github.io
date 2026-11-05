import { callFunction } from './supabaseClient';

/* The studio's own calls about orders.

   These were part of orderClient until customers had accounts of
   their own. They moved because of what importing them costs: every
   one goes through the administrator's Supabase client, and a module
   that creates an auth client does so the moment anything imports it.
   orderClient is in the shop's main bundle - the checkout needs it -
   so the admin client was being created on the storefront, for
   visitors who will never see the panel. Two auth clients on every
   page, one of them pointless, each with its own refresh timer, and a
   console warning to go with them.

   Nothing about the calls themselves changed. Same functions, same
   client, same session under 'ws-admin-auth', same server-side checks
   behind them. They simply live where only the admin bundle reaches.

   The panel is still told no by the server, not by this file: every
   one of these is refused unless the caller's own token belongs to an
   address in the admins table.                                     */

export async function listOrders(params = {}) {
  return await callFunction('admin-orders', params, { asAdmin: true });
}

export async function getOrder(orderId) {
  return await callFunction('admin-orders', { order_id: orderId }, { asAdmin: true });
}

export async function setOrderStatus(orderId, status) {
  return await callFunction('order-status', { order_id: orderId, status }, { asAdmin: true });
}

/* A URL for each photograph asked for, good for five minutes. The
   server decides which ones exist: ids belonging to another order are
   not refused so much as absent. Nothing is cached here - a URL that
   has expired is replaced by asking again, which also means the
   studio's own history records every look. */
export async function getPhotoDownloadUrls(orderId, photoIds) {
  const { downloads } = await callFunction(
    'photos-download',
    { order_id: orderId, photo_ids: photoIds },
    { asAdmin: true }
  );
  return downloads;
}

/* Irreversible. The panel asks for the order's code to be typed before
   this is called, and the server asks for it again. */
export async function deleteOrderPhotos(orderId, confirmCode) {
  return await callFunction(
    'photos-delete',
    { order_id: orderId, confirm_code: confirmCode },
    { asAdmin: true }
  );
}

/* Taking an order off the books once it has shipped.

   Everything about this is decided by the server - that the order is
   completed, that its photographs are gone, that the code typed is
   this order's. The panel only asks. */
export async function removeOrder(orderId, confirmCode) {
  return await callFunction(
    'order-remove',
    { order_id: orderId, confirm_code: confirmCode },
    { asAdmin: true }
  );
}
