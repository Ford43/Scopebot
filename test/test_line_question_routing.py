"""LINE routing regressions without a database, model or outbound LINE calls."""
import json
import os
import types
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
from api import models
from api.routers import line_webhook


class LineQuestionRoutingTests(unittest.TestCase):
    def test_pure_small_talk_keeps_its_response(self):
        cases = (
            ("สวัสดีครับ", "สวัสดีครับ/ค่ะ 😊 มีอะไรให้ช่วยเหลือไหมครับ?"),
            (" Hello! ", "สวัสดีครับ/ค่ะ 😊 มีอะไรให้ช่วยเหลือไหมครับ?"),
            ("สวัสดีค่ะ 😊", "สวัสดีครับ/ค่ะ 😊 มีอะไรให้ช่วยเหลือไหมครับ?"),
            ("ขอบคุณมากครับ", "ยินดีให้บริการเสมอครับ/ค่ะ 😊 หากมีคำถามเพิ่มเติมสามารถถามได้เลย"),
            ("thank you!", "ยินดีให้บริการเสมอครับ/ค่ะ 😊 หากมีคำถามเพิ่มเติมสามารถถามได้เลย"),
            ("โอเคขอบคุณ", "ยินดีให้บริการเสมอครับ/ค่ะ 😊 หากมีคำถามเพิ่มเติมสามารถถามได้เลย"),
            ("ลาก่อนครับ", "ลาก่อนครับ/ค่ะ 👋 หากต้องการความช่วยเหลือกลับมาได้เสมอนะครับ"),
            ("โอเคครับ", "ลาก่อนครับ/ค่ะ 👋 หากต้องการความช่วยเหลือกลับมาได้เสมอนะครับ"),
            ("bye 👋", "ลาก่อนครับ/ค่ะ 👋 หากต้องการความช่วยเหลือกลับมาได้เสมอนะครับ"),
            ("สบายดีไหมครับ?", "สบายดีครับ/ค่ะ 😊 ขอบคุณที่ถาม มีอะไรให้ช่วยเหลือไหมครับ?"),
        )
        for message, expected in cases:
            with self.subTest(message=message):
                self.assertEqual(line_webhook._handle_small_talk(message), expected)

    def test_questions_containing_small_talk_are_not_consumed(self):
        for message in (
            "สวัสดีครับ ขอทราบนโยบายคืนสินค้า",
            "ขอทราบเวลาเปิดร้าน ขอบคุณครับ",
            "history of product",
            "โอเค ขอทราบเวลาปิดร้าน",
            "บาย ขอทราบที่อยู่ร้านก่อน",
            "แบบสอบถามสบายดีไหมใช้อย่างไร",
        ):
            with self.subTest(message=message):
                self.assertIsNone(line_webhook._handle_small_talk(message))

    def test_mixed_questions_reach_rag_and_send_document_answer(self):
        for message in (
            "สวัสดีครับ ขอทราบนโยบายคืนสินค้า",
            "ขอทราบเวลาเปิดร้าน ขอบคุณครับ",
            "history of product",
        ):
            with self.subTest(message=message):
                bot = types.SimpleNamespace(
                    id=7, bot_id="routing-bot", is_line_connected=True,
                    line_channel_secret="test-secret", line_channel_token="test-token",
                    has_usable_knowledge=True, system_prompt=None,
                )
                session = types.SimpleNamespace(
                    id=11, line_display_name="Customer", mode=models.SessionMode.bot,
                )
                db = MagicMock()
                db.query.side_effect = lambda model: types.SimpleNamespace(
                    filter=lambda *args: types.SimpleNamespace(
                        first=lambda: bot if model is models.Bot else session,
                    ),
                )
                body = json.dumps({"events": [{
                    "type": "message", "replyToken": "reply-token",
                    "message": {"type": "text", "text": message},
                    "source": {"userId": "line-user"},
                }]}).encode("utf-8")
                with patch.object(line_webhook, "SessionLocal", return_value=db), \
                     patch.object(line_webhook, "_verify_signature", return_value=True), \
                     patch.object(line_webhook, "ApiClient"), \
                     patch.object(line_webhook, "MessagingApi") as messaging, \
                     patch.object(line_webhook, "_show_line_loading"), \
                     patch.object(line_webhook, "recent_bot_history", return_value=[]), \
                     patch.object(line_webhook, "ask_rag", return_value=("คำตอบจากเอกสาร", [])) as ask:
                    result = line_webhook._process_line_webhook("routing-bot", body, "signature")

                self.assertEqual(result, {"status": "ok"})
                ask.assert_called_once_with(message, "routing-bot", user_system_prompt=None, history=[])
                sent = messaging.return_value.reply_message.call_args.args[0]
                self.assertEqual([item.text for item in sent.messages], ["คำตอบจากเอกสาร"])
                saved = [call.args[0] for call in db.add.call_args_list
                         if isinstance(call.args[0], models.Conversation)]
                self.assertEqual([(row.question, row.answer, row.bot_id) for row in saved],
                                 [(message, "คำตอบจากเอกสาร", 7)])
                db.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
