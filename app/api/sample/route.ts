

export async function GET(request: Request) {
    const forwarded = request.headers["x-forwarded-for"]
    const realIp = request.headers["x-real-ip"]
    const ip = request.ip || "anonymous"
    console.log(forwarded)
    console.log(realIp)
    console.log(ip)

    return new Response(JSON.stringify({ forwarded, realIp, ip }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}