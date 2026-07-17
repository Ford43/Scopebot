from rag.rag_pipeline import ask_rag

def test_multi_bot():
    bots = ["bot_nt", "bot_travel"]

    question = "สามารถถามอะไรได้บ้าง"

    for bot in bots:
        print("\n" + "="*50)
        print(f"TEST BOT: {bot}")
        print("="*50)

        answer, sources = ask_rag(question, bot)

        print("\n💬 ANSWER:")
        print(answer)
        if sources:
            print("\n📎 SOURCES:")
            for s in sources:
                print(f"  - {s.get('filename')}: {s.get('snippet', '')[:80]}")


if __name__ == "__main__":
    test_multi_bot()