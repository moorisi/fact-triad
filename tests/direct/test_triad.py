import ast
import hashlib
import itertools
import json
import re
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]
REPO = 'moorisi/fact-triad'
TEXT = {
    'SUPPORTED': 'The service requires signed requests and rejects unsigned requests.',
    'REFUTED': 'The service accepts unsigned requests and does not require signatures.',
    'UNKNOWN': 'The documentation does not specify whether requests require signatures.',
}

@pytest.fixture
def triad(direct_deploy):
    return direct_deploy(str(ROOT / 'contracts/fact_triad.py'), REPO, 'The service requires signed requests and rejects unsigned requests.')

def inputs(claims, ids=None):
    ids = ids or ['A', 'B', 'C']
    bodies = [json.dumps({'id': identity, 'text': TEXT[claim]}).encode() for identity, claim in zip(ids, claims)]
    urls = [f'https://raw.githubusercontent.com/{REPO}/' + 'a' * 40 + f'/sources/{i}.json' for i in ['a','b','c']]
    return urls, [hashlib.sha256(b).hexdigest() for b in bodies], bodies

def mocks(vm, claims, ids=None, override=None, corrupt=False):
    vm.clear_mocks()
    urls, hashes, bodies = inputs(claims, ids)
    for i, (url, body, claim) in enumerate(zip(urls, bodies, claims)):
        identity = json.loads(body)['id']
        vm.mock_web(re.escape(url), {'status': 200, 'body': body + (b' ' if corrupt else b'')})
        analysis = {'claim': claim, 'polarity': 'UNKNOWN' if claim == 'UNKNOWN' else 'ACTIVE', 'quote': TEXT[claim]}
        if override and i == 0: analysis.update(override)
        vm.mock_llm(r'.*"id": "' + identity + r'", "text": ' + re.escape(json.dumps(TEXT[claim])) + r'.*', json.dumps(analysis))
    return urls, hashes

@pytest.mark.parametrize('claims,status', [
    (['SUPPORTED']*3, 'CORROBORATED'),
    (['REFUTED']*3, 'CORROBORATED'),
    (['SUPPORTED','REFUTED','UNKNOWN'], 'CONFLICT'),
    (['SUPPORTED','SUPPORTED','UNKNOWN'], 'INSUFFICIENT'),
])
def test_outcome_and_validator(triad, direct_vm, claims, status):
    triad.assess(*mocks(direct_vm, claims))
    assert triad.get_rounds()[0]['status'] == status
    assert direct_vm.run_validator() is True

def test_replay_cannot_append(triad, direct_vm):
    args = mocks(direct_vm, ['SUPPORTED']*3)
    triad.assess(*args)
    with direct_vm.expect_revert('unique sources'): triad.assess(*args)
    assert len(triad.get_rounds()) == 1

def test_duplicate_identity_cannot_append(triad, direct_vm):
    args = mocks(direct_vm, ['SUPPORTED','REFUTED','UNKNOWN'], ids=['A','A','C'])
    with direct_vm.expect_revert('Duplicate source identity'): triad.assess(*args)
    assert triad.get_rounds() == []

def test_validator_refetches_bytes(triad, direct_vm):
    triad.assess(*mocks(direct_vm, ['SUPPORTED']*3))
    mocks(direct_vm, ['SUPPORTED']*3, corrupt=True)
    assert direct_vm.run_validator() is False

def test_validator_rejects_different_claim(triad, direct_vm):
    triad.assess(*mocks(direct_vm, ['SUPPORTED']*3))
    mocks(direct_vm, ['SUPPORTED']*3, override={'claim':'REFUTED'})
    assert direct_vm.run_validator() is False

def test_validator_allows_other_anchored_quote(triad, direct_vm):
    triad.assess(*mocks(direct_vm, ['SUPPORTED']*3))
    mocks(direct_vm, ['SUPPORTED']*3, override={'quote':'The service requires signed requests'})
    assert direct_vm.run_validator() is True

@pytest.mark.parametrize('override', [{'quote':'Fabricated assertion without source support'}, {'claim':'YES'}, {'polarity':'UNKNOWN'}, {'quote':''}])
def test_malformed_extraction_cannot_append(triad, direct_vm, override):
    with direct_vm.expect_revert(): triad.assess(*mocks(direct_vm, ['SUPPORTED']*3, override=override))
    assert triad.get_rounds() == []

def test_commitment_mismatch_cannot_append(triad, direct_vm):
    with direct_vm.expect_revert('commitment mismatch'): triad.assess(*mocks(direct_vm, ['SUPPORTED']*3, corrupt=True))
    assert triad.get_rounds() == []

@pytest.mark.parametrize('kind', ['main','foreign','duplicates','count'])
def test_input_scope(triad, direct_vm, kind):
    urls, hashes = mocks(direct_vm, ['SUPPORTED']*3)
    if kind == 'main': urls[0] = urls[0].replace('a'*40, 'main')
    if kind == 'foreign': urls[0] = urls[0].replace(REPO, 'other/fact-triad')
    if kind == 'duplicates': hashes[1] = hashes[0]
    if kind == 'count': urls.pop()
    with direct_vm.expect_revert(): triad.assess(urls, hashes)
    assert triad.get_rounds() == []

@pytest.mark.parametrize('claims', list(itertools.product(TEXT, repeat=3)))
def test_all_27_aggregate_combinations(claims):
    tree = ast.parse((ROOT / 'contracts/fact_triad.py').read_text())
    function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'aggregate')
    namespace = {}
    exec(compile(ast.Module(body=[function], type_ignores=[]), '<aggregate>', 'exec'), namespace)
    active = set(claims) - {'UNKNOWN'}
    expected = 'CONFLICT' if len(active) == 2 else 'INSUFFICIENT' if 'UNKNOWN' in claims else 'CORROBORATED'
    assert namespace['aggregate']([{'analysis':{'claim':c}} for c in claims]) == expected
