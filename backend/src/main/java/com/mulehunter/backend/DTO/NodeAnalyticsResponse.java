package com.MuleTrace.backend.DTO;

import java.util.List;

import com.MuleTrace.backend.model.AnomalyScore;
import com.MuleTrace.backend.model.FraudExplanation;
import com.MuleTrace.backend.model.NodeEnriched;
import com.MuleTrace.backend.model.ShapExplanation;

public class NodeAnalyticsResponse {

    private NodeEnriched features;
    private AnomalyScore anomaly;
    private List<ShapExplanation> shap = List.of();
    private FraudExplanation reasons;

    public NodeAnalyticsResponse() {
    }

    public NodeEnriched getFeatures() {
        return features;
    }

    public void setFeatures(NodeEnriched features) {
        this.features = features;
    }

    public AnomalyScore getAnomaly() {
        return anomaly;
    }

    public void setAnomaly(AnomalyScore anomaly) {
        this.anomaly = anomaly;
    }

    public List<ShapExplanation> getShap() {
        return shap;
    }

    public void setShap(List<ShapExplanation> shap) {
        this.shap = shap;
    }

    public FraudExplanation getReasons() {
        return reasons;
    }

    public void setReasons(FraudExplanation reasons) {
        this.reasons = reasons;
    }

    public float getAnomalyScore() {
        return anomaly != null
                ? (float) anomaly.getAnomalyScore()
                : 0.0f;
    }

}
