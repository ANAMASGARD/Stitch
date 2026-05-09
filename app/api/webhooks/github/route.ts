import { NextResponse, NextRequest } from "next/server";

export async function POST(req: NextRequest) {
    try {
        await req.json();
        const event = req.headers.get("x-github-event");
        console.log(`Recieved github event: ${event}`);

        if (event === "ping") {
            return NextResponse.json({ message: "Pong" }, { status: 200 });
        }

        // TODO: HANDLE LATER

        return NextResponse.json({ message: "Event Processed" }, { status: 200 });
    } catch (error) {
        console.error("Error processing webhook:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}