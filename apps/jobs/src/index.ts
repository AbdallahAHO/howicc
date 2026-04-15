export default {
  async fetch(): Promise<Response> {
    return Response.json({
      success: true,
      status: 'idle',
    })
  },
  async queue(): Promise<void> {
    // Queue consumers will land once the upload/finalize path is wired.
  },
}
