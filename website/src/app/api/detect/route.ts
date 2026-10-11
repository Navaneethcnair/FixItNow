import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Forward the file to the Python detection service
        const pythonFormData = new FormData();
        pythonFormData.append('file', file);

        const response = await fetch('http://127.0.0.1:8001/detect', {
            method: 'POST',
            body: pythonFormData,
        });

        if (!response.ok) {
            throw new Error(`Detection service returned ${response.status}`);
        }

        const result = await response.json();
        return NextResponse.json(result);

    } catch (err: any) {
        return NextResponse.json(
            { error: 'Detection failed', details: err.message },
            { status: 500 }
        );
    }
}