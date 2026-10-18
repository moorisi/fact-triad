"""Source integrity, bounded state and independent stance replay regressions."""
import hashlib
import itertools
import json
import re

import pytest

from test_triad import REPO, ROOT, TEXT


@pytest.fixture
def triad(direct_deploy):
    return direct_deploy(str(ROOT / 'contracts/fact_triad.py'), REPO,
                         'The service requires signed requests and rejects unsigned requests.')


def arrange(vm, claims=('SUPPORTED',) * 3, round_id=0, bad=None, index=0):
    vm.clear_mocks()
    urls, hashes = [], []
    for i, claim in enumerate(claims):
        source = {'id': f'R{round_id}-{i}', 'text': TEXT[claim]}
        body = json.dumps(source).encode()
        if bad is not None and i == index:
            body = bad
        url = f'https://raw.githubusercontent.com/{REPO}/' + 'a'*40 + f'/sources/r{round_id}-{i}.json'
        urls.append(url)
        hashes.append(hashlib.sha256(body).hexdigest())
        vm.mock_web(re.escape(url), {'status': 200, 'body': body})
        vm.mock_llm(r'.*"id": "' + source['id'] + r'".*', json.dumps({
            'claim': claim, 'polarity': 'UNKNOWN' if claim == 'UNKNOWN' else 'ACTIVE',
            'quote': TEXT[claim]}))
    return urls, hashes


@pytest.mark.parametrize('claims', list(itertools.product(TEXT, repeat=3)))
def test_every_stance_combination_in_contract_and_validator(triad, direct_vm, claims):
    triad.assess(*arrange(direct_vm, claims))
    row, = triad.get_rounds()
    known = set(claims) - {'UNKNOWN'}
    expected = 'CONFLICT' if len(known) == 2 else 'INSUFFICIENT' if 'UNKNOWN' in claims else 'CORROBORATED'
    assert row['status'] == expected
    assert [s['analysis']['claim'] for s in row['sources']] == list(claims)
    assert direct_vm.run_validator() is True


@pytest.mark.parametrize('bad', [
    b'not-json', b'[]', b'\xff',
    b'{"id":"A","id":"B","text":"A sufficiently long source statement."}',
    b'{"id":"A","text":"short"}',
    b'{"id":"lowercase","text":"A sufficiently long source statement."}',
    json.dumps({'id': 'A', 'text': 'x'*5001}).encode(),
    json.dumps({'id': 'A', 'text': 'x'*20, 'extra': True}).encode(),
    b' ' * 12001,
])
def test_bad_committed_document_is_atomic_and_retryable(triad, direct_vm, bad):
    with direct_vm.expect_revert():
        triad.assess(*arrange(direct_vm, bad=bad))
    assert triad.get_rounds() == []
    triad.assess(*arrange(direct_vm))
    assert len(triad.get_rounds()) == 1
    assert direct_vm.run_validator() is True


@pytest.mark.parametrize('index', [0, 1, 2])
def test_validator_independently_checks_each_document(triad, direct_vm, index):
    triad.assess(*arrange(direct_vm))
    arrange(direct_vm, bad=b'{"id":"BROKEN"}', index=index)
    assert direct_vm.run_validator() is False


def test_sixteen_round_limit_preserves_all_previous_rounds(triad, direct_vm):
    for i in range(16):
        triad.assess(*arrange(direct_vm, round_id=i))
        assert direct_vm.run_validator() is True
    before = triad.get_rounds()
    assert len(before) == 16
    with direct_vm.expect_revert('Exactly three sources'):
        triad.assess(*arrange(direct_vm, round_id=16))
    assert triad.get_rounds() == before


def test_partial_reuse_cannot_consume_other_fresh_hashes(triad, direct_vm):
    old_urls, old_hashes = arrange(direct_vm)
    triad.assess(old_urls, old_hashes)
    urls, hashes = arrange(direct_vm, round_id=1)
    with direct_vm.expect_revert('unique sources'):
        triad.assess([old_urls[0], *urls[1:]], [old_hashes[0], *hashes[1:]])
    triad.assess(urls, hashes)
    assert len(triad.get_rounds()) == 2


@pytest.mark.parametrize('status', [404, 429, 500])
def test_http_failure_prevents_append(triad, direct_vm, status):
    urls, hashes = arrange(direct_vm)
    direct_vm.clear_mocks()
    direct_vm.mock_web(re.escape(urls[0]), {'status': status, 'body': b'unavailable'})
    with direct_vm.expect_revert('commitment mismatch'):
        triad.assess(urls, hashes)
    assert triad.get_rounds() == []
