import { NextRequest, NextResponse } from 'next/server';
import { mockMessages, isSupabaseConfigured } from '@/lib/jobStore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');
    const role = searchParams.get('role');

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          const filtered = data.filter((m: any) => {
            if (role === 'customer' && m.deleted_for_customer) return false;
            if (role === 'worker' && m.deleted_for_worker) return false;
            return true;
          });
          return NextResponse.json({ messages: filtered });
        }
      } catch (err) {
        console.warn('Supabase fetch messages failed:', err);
      }
    }

    const rawMsgs = mockMessages.get(bookingId) || [
      {
        id: 'welcome-msg-1',
        booking_id: bookingId,
        sender_id: 'system',
        sender_name: 'FixItNow Assistant',
        sender_role: 'system',
        text: '👋 Chat session started! You can coordinate service visit times, share location pins, or ask about tools.',
        created_at: new Date(Date.now() - 60000 * 5).toISOString(),
      }
    ];

    const messages = rawMsgs.filter((m: any) => {
      if (role === 'customer' && m.deleted_for_customer) return false;
      if (role === 'worker' && m.deleted_for_worker) return false;
      return true;
    });

    return NextResponse.json({ messages });
  } catch (error: any) {
    return NextResponse.json({ messages: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId, senderId, senderName, senderRole, text, mediaUrl } = body;

    if (!bookingId || !text) {
      return NextResponse.json({ error: 'bookingId and text are required' }, { status: 400 });
    }

    const newMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      booking_id: bookingId,
      sender_id: senderId || 'local-user',
      sender_name: senderName || (senderRole === 'worker' ? 'Worker' : 'Customer'),
      sender_role: senderRole || 'customer',
      text,
      media_url: mediaUrl || null,
      created_at: new Date().toISOString(),
      deleted_for_customer: false,
      deleted_for_worker: false,
    };

    if (isSupabaseConfigured()) {
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        await supabase.from('messages').insert({
          booking_id: bookingId,
          sender_id: senderId,
          text,
          media_url: mediaUrl,
        });
      } catch (err) {
        console.warn('Supabase save message failed:', err);
      }
    }

    const existing = mockMessages.get(bookingId) || [
      {
        id: 'welcome-msg-1',
        booking_id: bookingId,
        sender_id: 'system',
        sender_name: 'FixItNow Assistant',
        sender_role: 'system',
        text: '👋 Chat session started! You can coordinate service visit times, share location pins, or ask about tools.',
        created_at: new Date(Date.now() - 60000 * 5).toISOString(),
      }
    ];

    existing.push(newMessage);
    mockMessages.set(bookingId, existing);

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to send message' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');
    const bookingId = searchParams.get('bookingId');
    const body = await request.json().catch(() => ({}));
    const messageIds: string[] = body.messageIds || (messageId ? [messageId] : []);
    const deleterRole: string = searchParams.get('role') || body.deleterRole || 'customer';

    if (!messageIds.length) {
      return NextResponse.json({ error: 'messageId or messageIds required' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        await supabase
          .from('messages')
          .delete()
          .in('id', messageIds);
      } catch (err) {
        console.warn('Supabase delete messages failed:', err);
      }
    }

    if (bookingId && mockMessages.has(bookingId)) {
      const existing = mockMessages.get(bookingId) || [];
      const updated = existing
        .map((m: any) => {
          if (!messageIds.includes(m.id)) return m;
          // Own message -> Global delete for everyone
          if (m.sender_role === deleterRole || m.sender_role === 'system') {
            return null;
          }
          // Recipient's message -> Delete for me only
          if (deleterRole === 'customer') {
            return { ...m, deleted_for_customer: true };
          } else {
            return { ...m, deleted_for_worker: true };
          }
        })
        .filter((m: any) => m !== null && !(m.deleted_for_customer && m.deleted_for_worker));

      mockMessages.set(bookingId, updated);
    } else {
      for (const [bId, msgs] of mockMessages.entries()) {
        const updated = msgs
          .map((m: any) => {
            if (!messageIds.includes(m.id)) return m;
            if (m.sender_role === deleterRole || m.sender_role === 'system') {
              return null;
            }
            if (deleterRole === 'customer') {
              return { ...m, deleted_for_customer: true };
            } else {
              return { ...m, deleted_for_worker: true };
            }
          })
          .filter((m: any) => m !== null && !(m.deleted_for_customer && m.deleted_for_worker));

        mockMessages.set(bId, updated);
      }
    }

    return NextResponse.json({ success: true, deletedCount: messageIds.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
