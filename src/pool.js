/**
 * Runs `worker` over every item in `items`, keeping at most
 * `concurrency` workers active at the same time.
 */
export async function runPool(items, concurrency, worker) {
    const queue = [...items];
    await Promise.all(
        Array.from({ length: Math.min(concurrency, items.length) }, async () => {
            while (queue.length) await worker(queue.shift());
        }),
    );
}