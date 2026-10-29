import unittest
from types import SimpleNamespace
from rag.evidence import split_evidence_units, select_evidence_units


class ShiftEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.units = split_evidence_units([SimpleNamespace(metadata={}, page_content=
            'คู่มือพนักงาน\n- กะเช้า: เข้างาน 06:30 น. เปิดร้าน 07:00 น.\n'
            '- กะบ่าย: เข้างาน 13:00 น. ปิดร้าน 21:00 น.\n'
            '- กะที่ปิดร้านวันศุกร์ รับครัวซองต์รอบ 15:00 น.\n'
            '- วันอังคารพนักงานกะเช้าเวียนตรวจสต็อก 09:00–12:00 น.\n')])

    def test_all_shift_start_times_select_both_schedules(self):
        selected = select_evidence_units('เวลาเข้างานของแต่ละกะ', self.units)
        self.assertEqual(len(selected), 2)
        self.assertTrue(any('06:30' in u.text for u in selected))
        self.assertTrue(any('13:00' in u.text for u in selected))

    def test_morning_question_does_not_select_afternoon_or_stock_rotation(self):
        selected = select_evidence_units('กะเช้าเข้างานกี่โมง', self.units)
        self.assertEqual(len(selected), 1)
        self.assertIn('06:30', selected[0].text)

    def test_unknown_shift_does_not_borrow_other_shifts(self):
        self.assertEqual(select_evidence_units('กะดึกเข้างานกี่โมง', self.units), [])

    def test_structured_shift_answer_is_grounded_without_model_guessing(self):
        from rag.evidence import extract_shift_start_answer, validate_grounded_answer
        question = 'เวลาเข้างานของแต่ละกะ'
        selected = select_evidence_units(question, self.units)
        answer = extract_shift_start_answer(question, selected)
        self.assertIn('กะเช้าเข้างาน 06:30 น.', answer.answer)
        self.assertIn('กะบ่ายเข้างาน 13:00 น.', answer.answer)
        valid, reason = validate_grounded_answer(question, answer.answer, answer.evidence, selected)
        self.assertTrue(valid, reason)
        self.assertIsNone(extract_shift_start_answer('กะดึกเข้างานกี่โมง', self.units))

    def test_combined_unit_returns_requested_shift_only(self):
        from rag.evidence import EvidenceUnit, extract_shift_start_answer
        units = [EvidenceUnit('กะบ่าย: เข้างาน 13:00 น.; กะเช้า: เข้างาน 06:30 น.', {})]
        answer = extract_shift_start_answer('กะเช้าเข้างานกี่โมง', units)
        self.assertIn('06:30', answer.answer)
        self.assertNotIn('13:00', answer.answer)

    def test_conditional_schedule_needs_regular_pipeline(self):
        from rag.evidence import EvidenceUnit, extract_shift_start_answer
        units = [EvidenceUnit('เฉพาะวันหยุด กะเช้า: เข้างาน 09:00 น. แทนเวลาปกติ', {})]
        self.assertIsNone(extract_shift_start_answer('กะเช้าเข้างานกี่โมง', units))
