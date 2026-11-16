"""시장 국면 — 1차원 가우시안 HMM (상태 3개)을 EM(Baum-Welch)으로 맞춘다.

관측값은 유니버스 동일 비중 월 수익률이다. 상태는 평균 수익률 순으로 약세 · 횡보 · 강세라 부른다.
국면은 전체 구간으로 추정한 값(스무딩)이라 지난 시장을 설명하는 용도다 — 예측 모델의 입력으로 쓰지 않는다.
"""
from __future__ import annotations

from typing import Dict

import numpy as np

STATES = ["bear", "side", "bull"]   # 평균 수익률이 낮은 것부터


def _gauss(x: np.ndarray, mean: np.ndarray, var: np.ndarray) -> np.ndarray:
    return np.exp(-0.5 * (x[:, None] - mean) ** 2 / var) / np.sqrt(2 * np.pi * var)


def fit_hmm(x: np.ndarray, states: int = 3, iters: int = 200, tol: float = 1e-6) -> Dict[str, np.ndarray]:
    """x(관측값) → { mean, var, trans, gamma(시점 × 상태 확률) }. 상태는 평균이 낮은 것부터."""
    x = np.asarray(x, dtype=float)
    n = len(x)
    # 처음 값: 분위로 가른 묶음의 평균 · 분산, 머무를 확률 0.9
    edges = np.quantile(x, np.linspace(0, 1, states + 1))
    mean = np.array([x[(x >= edges[k]) & (x <= edges[k + 1])].mean() for k in range(states)])
    var = np.full(states, x.var() / 2 + 1e-8)
    trans = np.full((states, states), 0.1 / (states - 1))
    np.fill_diagonal(trans, 0.9)
    start = np.full(states, 1 / states)

    prev = -np.inf
    gamma = np.full((n, states), 1 / states)
    for _ in range(iters):
        b = _gauss(x, mean, var) + 1e-300
        # forward · backward (시점마다 크기를 맞춰 넘침을 막는다)
        alpha = np.zeros((n, states))
        scale = np.zeros(n)
        alpha[0] = start * b[0]
        scale[0] = alpha[0].sum()
        alpha[0] /= scale[0]
        for t in range(1, n):
            alpha[t] = (alpha[t - 1] @ trans) * b[t]
            scale[t] = alpha[t].sum()
            alpha[t] /= scale[t]
        beta = np.ones((n, states))
        for t in range(n - 2, -1, -1):
            beta[t] = (trans @ (b[t + 1] * beta[t + 1])) / scale[t + 1]
        gamma = alpha * beta
        gamma /= gamma.sum(axis=1, keepdims=True)
        xi = alpha[:-1, :, None] * trans[None] * (b[1:] * beta[1:])[:, None, :] / scale[1:, None, None]

        start = gamma[0]
        trans = xi.sum(axis=0) / gamma[:-1].sum(axis=0)[:, None]
        weight = gamma.sum(axis=0)
        mean = (gamma * x[:, None]).sum(axis=0) / weight
        var = (gamma * (x[:, None] - mean) ** 2).sum(axis=0) / weight + 1e-8

        loglik = np.log(scale).sum()
        if loglik - prev < tol:
            break
        prev = loglik

    order = np.argsort(mean)
    return {"mean": mean[order], "var": var[order], "trans": trans[order][:, order], "gamma": gamma[:, order]}
