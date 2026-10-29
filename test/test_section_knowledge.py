import unittest
from types import SimpleNamespace
from rag.evidence import split_evidence_units, select_evidence_units, validate_grounded_answer

MANUAL = '''คู่มือ
1. ชุดปฏิบัติงาน
- เสื้อเชิ้ตขาว กางเกงสีกากี
- รองเท้าหัวปิด ห้ามรองเท้าแตะ
2. เปิดร้าน (กะเช้า)
- เปิดเครื่อง ใช้เวลาวอร์ม 18 นาที
- บดเมล็ดกาแฟ 250 กรัม ห้ามบดเผื่อทั้งวัน
3. การดูแลต้นไม้
- รดน้ำตอนเช้า 1 ลิตร
'''


class SectionKnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.units = split_evidence_units([SimpleNamespace(page_content=MANUAL, metadata={'source':'manual.pdf'})])

    def test_numbered_headings_follow_each_child(self):
        unit = next(u for u in self.units if 'บดเมล็ด' in u.text)
        self.assertIn('เปิดร้าน', unit.metadata['section'])
        self.assertIn('เปิดร้าน', unit.text)

    def test_overview_selects_complete_relevant_section(self):
        selected=select_evidence_units('ระเบียบการใส่ชุดปฏิบัติงานมีอะไรบ้าง',self.units)
        self.assertEqual(len(selected),2)
        selected=select_evidence_units('เปิดร้านต้องทำอะไรบ้าง',self.units)
        self.assertEqual(len(selected),2)

    def test_new_topics_work_without_question_specific_rules(self):
        self.assertEqual(len(select_evidence_units('ต้องดูแลต้นไม้อย่างไรบ้าง',self.units)),1)

    def test_quote_need_not_repeat_its_heading(self):
        selected=select_evidence_units('เปิดร้านต้องทำอะไรบ้าง',self.units)
        valid,reason=validate_grounded_answer('เปิดร้านต้องทำอะไรบ้าง','วอร์ม 18 นาที',['เปิดเครื่อง ใช้เวลาวอร์ม 18 นาที'],selected)
        self.assertTrue(valid,reason)

    def test_unrelated_question_still_has_no_evidence(self):
        self.assertEqual(select_evidence_units('บริการนวดมีอะไรบ้าง',self.units),[])

    def test_thai_leading_vowel_does_not_turn_open_into_close(self):
        from rag.evidence import section_matches
        self.assertFalse(section_matches('เปิดร้านต้องทำอะไรบ้าง','4. ปิดร้าน (กะบ่าย)'))

    def test_duration_subject_can_span_separated_words(self):
        unit=SimpleNamespace(page_content='เปิดเครื่องเอสเพรสโซ่ ใช้เวลาวอร์ม 18 นาที',metadata={})
        self.assertEqual(len(select_evidence_units('เครื่องวอร์มกี่นาที',split_evidence_units([unit]))),1)

    def test_numbered_instructions_are_not_discarded(self):
        units=split_evidence_units([SimpleNamespace(page_content='คู่มือ\n1. เปิดเครื่อง\n2. ตรวจสอบน้ำ\n- ทำความสะอาด',metadata={})])
        self.assertIn('เปิดเครื่อง','\n'.join(u.text for u in units))

    def test_long_bullets_retain_section_identity(self):
        units=split_evidence_units([SimpleNamespace(page_content='คู่มือ\n1. เปิดร้าน\n- '+('ขั้นตอนยาวต้องเก็บครบ ' * 100),metadata={})])
        self.assertGreater(len(units),1)
        self.assertTrue(all(u.metadata.get('section')=='1. เปิดร้าน' for u in units))

    def test_incomplete_overview_never_returns_partial_list(self):
        from unittest.mock import patch
        from rag import rag_pipeline
        doc=SimpleNamespace(page_content='1. เปิดร้าน\nเปิดเครื่อง',metadata={'section_incomplete':True})
        with patch.object(rag_pipeline,'retrieve_docs',return_value=[doc]), patch.object(rag_pipeline.ollama,'chat') as model:
            answer,_=rag_pipeline.ask_rag('เปิดร้านต้องทำอะไรบ้าง','test')
        self.assertEqual(answer,'REQUIRE_HUMAN_HANDOFF')
        model.assert_not_called()

    def test_indexed_chunks_survive_second_evidence_pass_unchanged(self):
        docs=[SimpleNamespace(page_content=u.text,metadata=u.metadata) for u in self.units]
        self.assertEqual([u.text for u in split_evidence_units(docs)],[u.text for u in self.units])

    def test_model_can_cite_evidence_ids_without_retyping_quotes(self):
        from rag.evidence import parse_grounded_response
        result,reason=parse_grounded_response('{"answer":"18 นาที","evidence_ids":[1]}',self.units)
        self.assertIsNotNone(result,reason)
        self.assertEqual(result.evidence,[self.units[0].text])
        self.assertIsNone(parse_grounded_response('{"answer":"18 นาที","evidence_ids":[999]}',self.units)[0])

    def test_explicit_shift_qualifier_cannot_select_another_shift(self):
        from rag.evidence import section_matches
        self.assertFalse(section_matches('ขั้นตอนเปิดร้านกะบ่ายต้องทำอะไรบ้าง','1. เปิดร้าน (กะเช้า)'))

    def test_conditional_question_boilerplate_is_not_the_subject(self):
        units=split_evidence_units([SimpleNamespace(page_content='พนักงานที่เป็นไข้ ห้ามเข้าบาร์ ให้เก็บโต๊ะ',metadata={})])
        self.assertEqual(len(select_evidence_units('ถ้าเป็นไข้ต้องทำอย่างไร',units)),1)

    def test_model_abstention_can_return_strong_original_quote(self):
        from unittest.mock import patch
        from rag import rag_pipeline
        doc=SimpleNamespace(page_content='รองเท้าหัวปิดสีเข้ม ห้ามรองเท้าแตะ',metadata={'source':'manual.txt'})
        with patch.object(rag_pipeline,'retrieve_docs',return_value=[doc]), patch.object(rag_pipeline.ollama,'chat',return_value={'message':{'content':'{"answer":"ไม่พบข้อมูล","evidence_ids":[]}'}}):
            answer,sources=rag_pipeline.ask_rag('รองเท้าแตะใส่ได้ไหม','test')
        self.assertIn('ห้ามรองเท้าแตะ',answer)
        self.assertTrue(sources)
