from core_ai.graph.nodes.query_prep_node import expand_chat_abbreviations


def test_expands_common_shorthand():
    assert expand_chat_abbreviations("học bổng ntn") == "học bổng như thế nào"
    assert expand_chat_abbreviations("SV có đc miễn học phí ko") == "sinh viên có được miễn học phí không"


def test_leaves_words_containing_shorthand_alone():
    assert expand_chat_abbreviations("kỳ thi khoa học") == "kỳ thi khoa học"
    assert expand_chat_abbreviations("k65 ktx") == "k65 ký túc xá"
