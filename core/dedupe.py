class Dedupe:
    def __init__(self):
        self.seen_ids = set()

    def seen(self, rec) -> bool:
        k = rec.get("url")
        if k in self.seen_ids:
            return True
        self.seen_ids.add(k)
        return False
